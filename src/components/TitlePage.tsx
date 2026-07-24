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
import { ReadingProgressBar } from "./ReadingProgressBar";
import { getTitleDisplayName } from "src/utils/TitleUtils";
import { TitleNameModal } from "../modal/TitleNameModal";

interface Props {
    app: App;
    plugin: MangaReaderPlugin;
    path: string;
    onBack: () => void;
    onContinue: (chapter: string, resetPage?: boolean) => void; // Для кнопки "Продолжить"
    onSelectChapter: (chapter: string, resetPage?: boolean) => void;
}

// Интерфейс для таба - пока тусть тут
interface TabItem {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface ReadingProgressProps {
    lastChapter?: string;
    chapters: string[];
    label: (current: number, total: number) => string;
}


/* ===================================================
   Подкомпоненты
   =================================================== */

/** Для полоски прогресса будет еще использоваться в LibraryPage*/
const ReadingProgress = ({ lastChapter, chapters, label }: ReadingProgressProps) => {
    if (chapters.length === 0) return null;

    const index = chapters.findIndex((ch) => ch === lastChapter);
    const current = index >= 0 ? index + 1 : 0;
    const total = chapters.length;
    const percent = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="reading-progress">
            <div className="progress-label">{label(current, total)}</div>
            <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

/** Подпись вкладки с проверкой переполнения. */
const MarqueeText = ({ text }: { text: string }) => {
    const ref = React.useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setOverflow(el.scrollWidth > el.clientWidth);
    }, [text]);

    return (
        <span
            ref={ref}
            className={`tab-label ${overflow ? "tab-label-overflow" : ""}`}
            title={text}
        >
            {text}
        </span>
    );
};

/** Обёртка с двумя областями: шапка вкладок + контент. */
const TabView = ({ tabs }: { tabs: TabItem[] }) => {
    const [activeId, setActiveId] = React.useState<string>(tabs[0]?.id ?? "");
    const activeTab = tabs.find((t) => t.id === activeId);

    return (
        <div className="tab-view">
            <div className="tab-header">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeId === tab.id ? "active" : ""}`}
                        onClick={() => setActiveId(tab.id)}
                    >
                        <MarqueeText text={tab.label} />
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {activeTab?.content}
            </div>
        </div>
    );
};

/* ===================================================
   Основной компонент
   =================================================== */
export const TitlePage = ({
    app,
    plugin,
    path,
    onBack,
    onContinue,
    onSelectChapter
}: Props) => {
    const t = translations[plugin.data.settings.language || "en"]
    const progress = plugin.data.library[path];

    const [titleName, setTitleName] = React.useState(
    plugin.data.library[path]?.titleName || getTitleDisplayName(path, progress)
);
    // const titleName = getTitleDisplayName(path, progress)

    const chapters = useChapterList(app, path);

    // Заметка - описание
    const {
        description,
        comments,
        tags,
        exists,
        ensureNote,
        openNote
    } = useTitleNote(
        app, 
        titleName, 
        plugin.data.settings.notesFolder, 
        progress.noteFileName,
        (newName) => {
            if (!plugin.data.library[path]) {
                plugin.data.library[path] = { lastChapter: "", lastPage: 1 };
            }
            plugin.data.library[path].noteFileName = newName;
            plugin.saveProgress();
        }
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

    const handleCustomTitleName = () => {
        new TitleNameModal(
            app,
            titleName,
            (newName: string) => {
                const trimmed = newName.trim();
                if (!trimmed) return;

                if (!plugin.data.library[path]) {
                    plugin.data.library[path] = { lastChapter: "", lastPage: 1 };
                }
                plugin.data.library[path].titleName = trimmed;
                plugin.saveProgress();
                setTitleName(trimmed);
            }
        ).open();
    };

    // Кэшируем общее число глав (LibraryPage позже прочитает это же поле)
    // Спорный момент
    React.useEffect(() => {
        if (chapters.length > 0) {
            if (!plugin.data.library[path]) {
                plugin.data.library[path] = { lastChapter: "", lastPage: 1 };
            }
            plugin.data.library[path].totalChapters = chapters.length;
            plugin.saveProgress();
        }
    }, [chapters.length, path, plugin]);

    // При монтировании и при смене titleName — создаём/переименовываем заметку.
    // ensureNote сама зависит от titleName внутри хука, так что
    // при смене имени она пересоздастся и эффект вызовется снова.
    React.useEffect(() => {
        let cancelled = false;
        ensureNote().catch((err) => {
            if (!cancelled) console.error("ensureNote failed:", err);
        });
        return () => {
            cancelled = true;
        };
    }, [ensureNote]);

    /**Надо переименовать скорее всего */
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

    const chapterIndex = chapters.findIndex((ch) => ch === progress?.lastChapter);
    const currentChapter = chapterIndex >= 0 ? chapterIndex + 1 : 0;
    const totalChapters = chapters.length;

    const tabs: TabItem[] = [
        {
            id: "description",
            label: t.tabDescription,
            content: (
                <div className="tab-panel">
                    {/* Описание */}
                    <div
                        className={`title-note-preview ${exists ? "has-note" : ""}`}
                        onDoubleClick={openNote}
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

                    {/* Теги */}
                    <div
                        className={`title-note-preview tag-preview ${exists ? "has-note" : ""}`}
                        onDoubleClick={openNote}
                        title="Двойной клик — открыть/создать заметку"
                    >
                        {exists && tags.length > 0 ? (
                            <div className="tag-cloud">
                                {tags.map((tag) => (
                                    <span key={tag} className="tag-chip">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="note-placeholder">
                                {exists ? t.noteTagsEmpty : t.notePlaceholder}
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            id: "chapters",
            label: t.tabChapters,
            content: (
                <ChapterListPage
                    plugin={plugin}
                    chapters={chapters}
                    onSelectChapter={(name) => onSelectChapter(name, true)}
                />
            ),
        },
        {
            id: "comments",
            label: t.tabComments,
            content: (
                <div
                    className={`title-note-preview ${exists ? "has-note" : ""}`}
                    onDoubleClick={openNote}
                    title="Двойной клик — открыть/создать заметку"
                >
                    {exists && comments ? (
                        <MarkdownNote app={app} source={comments} path={path} />
                    ) : (
                        <div className="note-placeholder">
                            {exists ? t.noteCommentsEmpty : t.notePlaceholder}
                        </div>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="title-showcase">
            
            {/* [хедер страницы тайтла] */}
            <div className="title-header">
                <button onClick={onBack}>{t.back}</button>
            </div>

            <div className="title-layout-row">
                {/* Левая колонка */}
                {/* Постер + название + кнопка «Продолжить» */}
                <div className="top-showcase">
                    <ImagePoster
                        app={app}
                        images={posterImages}
                        onDoubleClick={handlePosterDoubleClick}
                    />
                    <div 
                        className="title-info"
                        title="Нажмите для смены названия"
                        onClick={handleCustomTitleName}
                    >
                        {titleName}
                        </div>

                    {/* === Прогресс чтения === */}
                    {/* Старый */}
                    {/* <ReadingProgress
                        lastChapter={progress?.lastChapter}
                        chapters={chapters}
                        label={t.chapterCount}
                    /> */}

                    <ReadingProgressBar
                        current={currentChapter}
                        total={totalChapters}
                        label={t.chapterCount(currentChapter, totalChapters)}
                    />

                    <div className="start-button">
                        {progress?.lastChapter ? (
                            <button
                                style={{
                                    background: "var(--interactive-accent)",
                                    color: "var(--text-on-accent)",
                                }}
                                onClick={() => onContinue(progress.lastChapter, false)}
                            >
                                {t.continue(progress.lastChapter, progress.lastPage)}
                            </button>
                        ) : (
                            <p>{t.noStartReading}</p>
                        )}
                    </div>
                </div>

                {/* Правая колонка */}
                
                <TabView tabs={tabs} />
            </div>
        </div>
    );
};