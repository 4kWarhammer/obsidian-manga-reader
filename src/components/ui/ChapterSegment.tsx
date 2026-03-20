import * as React from "react";
import { MangaPage } from "./MangaPage";
import { ImageProvider } from "src/types";

interface ChapterSegmentProps {
    chapterName: string;
    totalPages: number;
    imageProvider: ImageProvider;
}

/**
 * Глупый компонент для рендеринга сегмента главы.
 * Только получает данные и рендерит страницы.
 * Не содержит useEffect, не загружает данные самостоятельно.
 */
export const ChapterSegment: React.FC<ChapterSegmentProps> = ({
    chapterName,
    totalPages,
    imageProvider
}) => {
    // Если totalPages ещё не загружен — рендерим заглушку
    if (totalPages === 0) {
        return (
            <div className="chapter-segment chapter-segment-loading" data-chapter={chapterName}>
                <div className="spinner"></div>
                <p>Загрузка главы...</p>
            </div>
        );
    }

    // Рендерим страницы
    return (
        <div
            className="chapter-segment"
            data-chapter={chapterName}
        >
            {Array.from({ length: totalPages }).map((_, idx) => {
                const key = `${chapterName}:${idx}`;
                return (
                    <MangaPage
                        key={key}
                        index={idx}
                        chapterName={chapterName}
                        url={imageProvider.loadedUrls.get(key) || undefined}
                        isLoading={imageProvider.isLoading(chapterName, idx)}
                    />
                );
            })}
        </div>
    );
};
