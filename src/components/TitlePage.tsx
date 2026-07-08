import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { ChapterListPage } from "./ChapterListPage";
import { translations } from "src/i18n";
import { useChapterList } from "src/hooks/useChapterList";
import { useTitleBackgroundPreindex } from "src/hooks/useTitleBackgroundPreindex";

interface Props {
    app: App;
    plugin: MangaReaderPlugin;
    path: string;
    onBack: () => void;
    // Тут второй аргумент необязателен, поэтому ставим ?
    onContinue: (chapter: string, resetPage?: boolean) => void; // Для кнопки "Продолжить"
    onSelectChapter: (chapter: string, resetPage?: boolean) => void;
}

export const TitlePage = ({ app, plugin, path, onBack, onContinue, onSelectChapter }: Props) => {
    const t = translations[plugin.data.settings.language || "en"]
    const progress = plugin.data.library[path];
    
    const titleName = path.split(/[\\/]/).pop();

    const chapters = useChapterList(app, path);

    useTitleBackgroundPreindex({
        app,
        plugin,
        parentPath: path,
        chapters,
        enabled: true,
    });

    return (
        <div className="title-showcase">
            
            {/* [хедер страницы тайтла] */}
            <div className="title-header">
                <button onClick={onBack}>{t.back}</button>
            </div>

            <div className="top-showcase">
                {/* Постер */}
                <div className="poster"> 🖼 Постер </div>
                <div className="title-info">
                    {titleName}
                </div>                

                {/* кнопка продолжить */} 
                <div className="start-button">
                    {progress?.lastChapter ? (
                        <button 
                            style={{ background: "var(--interactive-accent)", color: "var(--text-on-accent)" }}
                            onClick={() => onContinue(progress.lastChapter, false)}
                        >
                            {t.continue (progress.lastChapter, progress.lastPage)}
                            {/* Продолжить: {progress.lastChapter} (стр. {progress.lastPage}) */}
                        </button>
                    ) : (
                        <p>{t.noStartReading}</p>
                    )}
                </div>
            </div>

            <hr />

            {/* ВЫЗЫВАЕМ НАШ КОМПОНЕНТ ГЛАВ (ChapterListPage) */}
            <div className="bottom-showcase">
                <h3>{t.chapterList}</h3>
                <ChapterListPage
                    plugin={plugin}
                    chapters={chapters}
                    onSelectChapter={(name) => onSelectChapter(name, true)}
                />
            </div>
        </div>
    );
};