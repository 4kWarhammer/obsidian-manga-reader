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
import { TitleRating } from "./TitleRating";
import * as Lucide from "lucide-react";

interface Props {
    app: App;
    plugin: MangaReaderPlugin;
    path: string;
    onContinue: (chapter: string, resetPage?: boolean) => void; // Для кнопки "Продолжить"
    onSelectChapter: (chapter: string, resetPage?: boolean) => void;
}

// Интерфейс для таба - пока тусть тут
interface TabItem {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface MetaItems {
    id: string;
    isValid: boolean;
    className: string;
    label: string;
    content: any;
}

interface ReadingProgressProps {
    lastChapter?: string;
    chapters: string[];
    label: (current: number, total: number) => string;
}


/* ===================================================
   Подкомпоненты
   =================================================== */

/** Подпись вкладки с проверкой переполнения. */
const MarqueeText = ({ text }: { text: string }) => {
    const viewportRef = React.useRef<HTMLSpanElement>(null);
    const contentRef = React.useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = React.useState(false);
    const [distance, setDistance] = React.useState(0);

    React.useEffect(() => {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const overflowAmount = content.scrollWidth - viewport.clientWidth;

        setOverflow(overflowAmount > 0);
        setDistance(overflowAmount);
    }, [text]);

    return (
        <span
            ref={viewportRef}
            className="marquee-viewport"
            title={text}
        >
            <span
                ref={contentRef}
                className={`marquee-content ${overflow ? "marquee-content-overflow" : ""}`}
                style={{ "--marquee-distance": `${distance}px` } as React.CSSProperties}
            >
                {text}
            </span>
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
        rating,
        otherMetaData: info,
        exists,
        ensureNote,
        openNote,
        updateFrontmatter
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
            // label: t.tabDescription,
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
                        className={`title-tag-preview ${exists ? "has-note" : ""}`}
                        // onDoubleClick={openNote}
                        // title="Двойной клик — открыть/создать заметку"
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

    // Для общей информации создадим массив
    // лучше задать типизацию, если потом буду добавлять
    const metaItems = [
        {
            id: 'year',
            isValid: info.year !== null,
            className: 'meta-year',
            label: 'Год',
            content: info.year,
        },
        {
            id: 'aliases',
            isValid: info.aliases && info.aliases.length > 0,
            className: 'meta-aliases',
            label: 'Альтернативные названия',
            // Если это массив — джойним, если строка — оставляем как есть
            content: Array.isArray(info.aliases) ? info.aliases.join(" / ") : info.aliases,
        },
        {
            id: 'artist',
            isValid: info.artist && info.artist.length > 0,
            className: 'meta-artist',
            label: 'Артист',
            content: Array.isArray(info.artist) ? info.artist.join(" / ") : info.artist,
        },
        {
            id: 'author',
            isValid: info.author && info.author.length > 0,
            className: 'meta-author',
            label: 'Автор',
            content: Array.isArray(info.author) ? info.author.join(" / ") : info.author,
        },
        {
            id: 'journal',
            isValid: info.journal && info.journal.length > 0,
            className: 'meta-journal',
            label: 'Журнал',
            content: Array.isArray(info.journal) ? info.journal.join(" / ") : info.journal,
        },
        {
            id: 'franchise',
            isValid: info.franchise && info.franchise.length > 0,
            className: 'meta-franchise',
            label: 'Франшиза',
            content: Array.isArray(info.franchise) ? info.franchise.join(" / ") : info.franchise,
        },
        {
            id: 'publisher',
            isValid: info.publisher && info.publisher.length > 0,
            className: 'meta-publisher',
            label: 'Издательство',
            content: Array.isArray(info.publisher) ? info.publisher.join(" / ") : info.publisher,
        },
    ];

    // Фильтруем: оставляем только валидные элементы и исключаем 'aliases'
    const activeMetaItems = metaItems.filter(item => item.isValid && item.id !== 'aliases');

    // Для использования отдельно находим конкретно 'aliases' (он уже проверен на isValid)
    // const aliasesItem = metaItems.find(item => item.id === 'aliases' && item.isValid && item.content ===);

    const aliasesItem = info.aliases
        ? info.aliases.join (" / ")
        : ""

    return (
        <div className="title-showcase">
            
            {/* [хедер страницы тайтла] */}
            <div className="title-header">
                {/* <button onClick={onBack}>{t.back}</button> */}
            </div>

            <div className="title-layout-row">
                {/* Левая колонка */}
                {/* Постер + название + кнопка «Продолжить» */}
                <div className="title-left-column">
                    {/* Постер */}
                    <ImagePoster
                        app={app}
                        images={posterImages}
                        onDoubleClick={handlePosterDoubleClick}
                    />

                    {/* Прогресс бар */}
                    <ReadingProgressBar
                        current={currentChapter}
                        total={totalChapters}
                        label={t.chapterCount(currentChapter, totalChapters)}
                        display={false}
                    />
                </div>

                {/* Правая колонка */}
                <div className="title-right-column">
                    {/* Локальный хэдер для правой колонки */}
                    <div className="right-column-header">
                        {/* Название */}
                        <div className="title-info">
                            <div 
                                className="title-name"
                                title="Нажмите для смены названия"
                                onClick={handleCustomTitleName}
                            >
                                <MarqueeText text={titleName}/>
                            </div>

                            <div className="title-aliases">
                                <MarqueeText text={aliasesItem}/>

                            </div>
                            
                        </div>

                        {/* Рейтинг */}
                        <TitleRating
                            rating={rating}
                            app={app}
                            onChange={(val) => updateFrontmatter({ rating: val })}
                        />
                    </div>

                    {/* Снопка старт/продолжить */}
                    <div
                    className="buttons-line">
                        <button
                            className="start-button"
                            title={`${t.continue} ${progress.lastChapter}, ${progress.lastPage}`}
                            onClick={() => onContinue(progress.lastChapter, false)}
                        >
                            <MarqueeText text={progress?.lastChapter 
                                ? t.continue
                                : t.noStartReading
                            }/>
                        </button>

                        <button
                            className="note-button"
                            title="Создать или открыть заметку"
                            onClick={openNote}
                        >
                            <Lucide.NotebookPen size={16} />
                        </button>
                    </div>

                    {/* Побласть с закладками */}
                    <TabView tabs={tabs} />
                </div>

            </div>
        </div>
    );
};