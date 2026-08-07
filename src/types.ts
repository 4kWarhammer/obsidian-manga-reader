// Это «контракт», описывающий структуру данных. 
// Так удобнее, чем держать это в голове.

// Прогресс чтения манги
export interface MangaProgress {
    lastChapter: string; // соответствует ReaderAnchor.chapterName, вроде как
    lastPage: number;    // соответствует ReaderAnchor.pageIndex, вроде бы как
    title?: string;      // Описание - в заметке
    tags?: string[];     // Жанры - также в заметке
    notes?: string;      // Личные комментарии - буду в заметке держать
    posterImages?: string[];    // Для постеров
    rating?: string;            // Рейтинг - но я буду держать его в заметках
    totalChapters?: number;     // Удобно для progressbar
    titleName?: string;         // Читаемое название тайтла
    noteFileName?: string;      // имя файла заметки в notesFolder
}

// Интерфейс поставщика подготовленных изображений
export interface VirtualImageProvider {
    loadedUrls: Map<string, string>;
    isLoading: (chapter: string, index: number) => boolean;
    isInRange: (chapter: string, index: number) => boolean;
    releasePage: (chapter: string, index: number) => void;
    clear: () => void;
}

// Структура data.json
export interface PluginData {
    settings: {
        viewMode: 'scroll' | 'single';
        language: "ru" | "en";
        indexWarmerMode: 'adjacent' | 'extended';
        readerBackgroundIndexing: boolean;
        pageGap: number;
        readerWidthPercent: number;
        notesFolder: string;    // Пока тут пусть, но как будто бы надо переделать путь
        imagesFolder: string;
    };
    library: { [path: string]: MangaProgress };
    defaultLibraryPath: string;
    externalSources: string[];
}

// 3. Дефолтные значения для инициализации плагина
export const DEFAULT_DATA: PluginData = {
    settings: {
        viewMode: 'scroll',
        language: "en",
        indexWarmerMode: 'adjacent',
        readerBackgroundIndexing: false,
        pageGap: 5,
        readerWidthPercent: 100,
        notesFolder: "MangaReader/Notes",   // Также пока пусть будет
        imagesFolder: "MangaReader/Images",
    },
    library: {},
    defaultLibraryPath: "",
    externalSources: []
};


// ============================================================
// Indexing types (для виртуального ридера)
// ============================================================

// --- Источник главы ---
export type ChapterSourceType =
    | 'vault-folder'
    | 'vault-archive'
    | 'external-folder'
    | 'external-archive';

// --- Сигнатура для валидации кэша ---
export interface ChapterSignatureArchive {
    kind: 'archive';
    path: string;
    size: number;
}
export interface ChapterSignatureFolder {
    kind: 'folder';
    path: string;
    fileCount: number;
    filesHash: string;
}
export type ChapterSignature = ChapterSignatureArchive | ChapterSignatureFolder;

// ============================================================
// Персистентные метаданные (сохраняются в кэше)
// ============================================================
export interface CachedPageMetadata {
    index: number;
    fileName: string;
    width: number;
    height: number;
    aspectRatio: number;
    mimeType: string;
}

export interface CachedChapterIndex {
    chapterKey: string;
    titleKey: string;
    sourcePath: string;
    sourceType: ChapterSourceType;
    signature: ChapterSignature;
    schemaVersion: number;
    extractorVersion: number;
    indexedAt: number;
    pageCount: number;
    pages: CachedPageMetadata[];
}

// --- Основной интерфейс для записи кэша ---
export interface ImageIndexCacheFile {
    schemaVersion: number;
    extractorVersion: number;
    updatedAt: number;
    chapters: Record<string, CachedChapterIndex>;
}

// ============================================================
// Runtime Layout
// ============================================================
// Страницы, их данные в разрезе отдельной главы
export interface PageLayout {
    chapterKey: string;
    index: number;
    fileName: string;
    width: number;
    height: number;
    aspectRatio: number;
    mimeType: string;
    renderedWidth: number;
    renderedHeight: number;
    offsetTopInChapter: number;
    offsetBottomInChapter: number;
}

export interface ChapterLayout {
    chapterKey: string;
    chapterName: string;
    pages: PageLayout[];
    totalHeight: number;
}

// Страницы, их данные в разрезе всего ридера
export interface ReaderPageLayout extends PageLayout{
    chapterName: string;
    chapterOffsetTop: number;
    offsetTopInReader: number;
    offsetBottomInReader: number;
}

export interface ReaderLayout {
    chapters: ChapterLayout[];
    pages: ReaderPageLayout[];
    totalHeight: number;
}

export interface VisibleRange {
    start: number;
    end: number;
}
// ============================================================
// Runtime Reader anchor
// ============================================================

/**
 * Какая глава/страница сейчас активна при переключении режимов чтения
 */
export interface ReaderAnchor {
    chapterName: string;
    pageIndex: number;
}

// --- Версии кэша ---
export const CURRENT_IMAGE_INDEX_SCHEMA_VERSION = 1;
export const CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION = 1;
