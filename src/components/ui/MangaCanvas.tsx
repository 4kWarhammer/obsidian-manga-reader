import * as React from "react";
import { MangaPage } from "./MangaPage";
import { ReaderHeader } from "./ReaderHeader";

interface MangaCanvasProps {
    containerRef: React.RefObject<HTMLDivElement>
    isLoading: boolean;
    viewMode: "scroll" | "single";
    onToggleViewMode: () => void;
    loadedChapters: { chapterName: string; images: string[] }[];
    currentPage: number;
    chapterName: string; // текущая активная глава из пропсов
    allChapters: string[],
    onBack:() => void,
    onChapterChange:(chapterName: string, resetPage?: boolean) => void,
    images: string[];    // изображения текущей главы (для single mode)
    onPageClick: (index: number, chName: string) => void;
    hasNextChapter: boolean;
}

// Это наш "диспетчер" для отображаемых элементов
export const MangaCanvas = ({ 
    containerRef,
    isLoading,
    viewMode,
    onToggleViewMode,
    loadedChapters, 
    currentPage, 
    chapterName, 
    allChapters, 
    onBack, 
    onChapterChange, 
    images, 
    onPageClick, 
    hasNextChapter 
}: MangaCanvasProps) => {

    // Диспетчер состояний: если грузимся - рисуем только лоадер
    if (isLoading) {
        return (
            <div className="manga-reader-loading">
                <div className="spinner"></div>
                <p>Загрузка контента...</p>
            </div>
        );
    }

    return (
        // Парящий заголовок
        <div ref={containerRef} className="manga-canvas-root">
            {/* containerRef - Теперь ReaderPage снова "видит" контейнер */}

            {/* Контейнер-триггер, который всегда приклеен к топу */}
            <div className="header-wrapper">
                <ReaderHeader 
                    chapterName={chapterName}
                    allChapters={allChapters}
                    onBack={onBack}
                    onChapterChange={(name) => onChapterChange(name, true)}
                    viewMode={viewMode}
                    onToggleViewMode={onToggleViewMode}
                />
            </div>
            
            {/* Дальше текущий код */}
            {viewMode === "scroll" ? (
                // Диспетчер режимов: Скролл
                <div className="manga-reader-container scroll-mode">
                    {loadedChapters.map((chapter) => (
                        <div key={chapter.chapterName} className="manga-chapter-section">
                            {chapter.images.map((url, idx) => (
                                <MangaPage 
                                    key={url} 
                                    url={url} 
                                    index={idx} 
                                    chapterName={chapter.chapterName}
                                />
                            ))}
                        </div>
                    ))}
                    
                    <div id="end-of-list-sensor" className="manga-sensor">
                        {hasNextChapter ? "Загрузка следующей главы..." : "Конец истории"}
                    </div>
                </div>
            ) : (
                // Диспетчер режимов: Постранично
                <div className="manga-reader-container single-mode">


                    {images.length > 0 && (
                        <MangaPage 
                            url={images[currentPage]} 
                            index={currentPage} 
                            chapterName={chapterName}
                            onClick={onPageClick}
                        />
                    )}

                </div>


            )}
        </div>
    )
};