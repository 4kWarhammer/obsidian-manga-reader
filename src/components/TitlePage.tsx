import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { ChapterListPage } from "./ChapterListPage";
import { translations } from "src/i18n";
import { useChapterList } from "src/hooks/useChapterList";
import { useTitleBackgroundPreindex } from "src/hooks/useTitleBackgroundPreindex";
import { ImagePoster } from "./ImagePoster";
import { ImageSelectModal } from "../modal/ImageSelectModal";
import { useTitleNote } from "src/hooks/useTitleNote";
import { MarkdownNote } from "./MarkDownNote";

interface Props {
    app: App;
    plugin: MangaReaderPlugin;
    path: string;
    onBack: () => void;
    onContinue: (chapter: string, resetPage?: boolean) => void; // Для кнопки "Продолжить"
    onSelectChapter: (chapter: string, resetPage?: boolean) => void;
}

export const TitlePage = ({ app, plugin, path, onBack, onContinue, onSelectChapter }: Props) => {
    const t = translations[plugin.data.settings.language || "en"]
    const progress = plugin.data.library[path];
    
    const titleName = path.split(/[\\/]/).pop();

    const chapters = useChapterList(app, path);

    // Заметка - описание
    const {
        description,
        comments,
        tags,
        exists,
        openOrCreate
    } = useTitleNote(
        app,
        path,
        plugin.data.settings.notesFolder
    );

    // Для постера
    const [posterImages, setPosterImages] = React.useState<string[]>(
        plugin.data.library[path]?.posterImages || []
    );

    useTitleBackgroundPreindex({
        app,
        plugin,
        parentPath: path,
        chapters,
        enabled: true,
    });

    const handlePosterDoubleClick = () => {
        const onSave = (selected: string[]) => {
            setPosterImages(selected);
            if (!plugin.data.library[path]) {
                plugin.data.library[path] = { lastChapter: "", lastPage: 1 };
            }
            plugin.data.library[path].posterImages = selected;
            plugin.saveProgress();
        };

        new ImageSelectModal(
            app,
            plugin.data.settings.imagesFolder,
            posterImages,
            onSave
        ).open();
    };

    return (
        <div className="title-showcase">
            
            {/* [хедер страницы тайтла] */}
            <div className="title-header">
                <button onClick={onBack}>{t.back}</button>
            </div>

            <div className="top-showcase">
                {/* Постер */}
                <ImagePoster
                    app={app}
                    images={posterImages}
                    onDoubleClick={handlePosterDoubleClick}
                />
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

            {/* === БЛОК ЗАМЕТКИ === */}
            <div
                className={`title-note-preview ${exists ? "has-note" : ""}`}
                onDoubleClick={openOrCreate}
                title="Двойной клик — открыть/создать заметку"
            >
                {exists && description ? (
                    <MarkdownNote app={app} source={description} path={path} />
                ) : (
                    <div className="note-placeholder">
                        {exists ? t.noteDescriptionEmpty : t.notePlaceholder}
                    </div>
                )}
            </div>

            {/* === БЛОК Комментариев === */}
            <div
                className={`title-note-preview ${exists ? "has-note" : ""}`}
                onDoubleClick={openOrCreate}
                title="Двойной клик — открыть/создать заметку"
            >
                {exists && comments ? (
                    <MarkdownNote app={app} source={comments} path={path} />
                ) : (
                    <div className="note-placeholder">
                        {exists ? t.noteDescriptionEmpty : t.noteCommentsEmpty}
                    </div>
                )}
            </div>

            {/* === БЛОК ТЕГОВ === */}
            <div
                className={`title-note-preview tag-preview ${exists ? "has-note" : ""}`}
                onDoubleClick={openOrCreate}
                title="Двойной клик — открыть/создать заметку"
            >
                {exists && tags.length > 0 ? (
                    <div className="tag-cloud">
                        {tags.map((tag) => (
                            <span key={tag} className="tag-chip">{tag}</span>
                        ))}
                    </div>
                ) : (
                    <div className="note-placeholder">
                        {exists ? t.noteTagsEmpty : t.notePlaceholder}
                    </div>
                )}
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