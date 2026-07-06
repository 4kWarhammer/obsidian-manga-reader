// Это «контракт», описывающий структуру данных. 
// Так удобнее, чем держать это в голове.

// 1. Описываем, что такое прогресс для одной манги
export interface MangaProgress {
    lastChapter: string;
    lastPage: number;
    title?: string;      // Описание
    tags?: string[];     // Жанры
    notes?: string;      // Личные комментарии
}

export interface ImageProvider {
    // Основные методы - теперь с chapterName
    getImageUrl: (chapter: string, index: number) => Promise<string>;
    isLoading: (chapter: string, index: number) => boolean;

    // Реактивный кэш URL
    loadedUrls: Map<string, string>;
    releasePage: (chapter: string, index: number) => void;

    // Навигация
    isInRange: (chapter: string, index: number) => boolean;
    setVisible: (index: number) => void;
    visibleIndex: number;  // ← Текущая видимая страница
    getAllChapters: () => string[]
    getTotalPages: () => number;
    getTotalPagesForChapter: (chapter: string) => Promise<number>;

    // Мульти-глава
    transitionToChapter: (chapter: string, startIndex?: number) => void;
    getCurrentChapter: () => string;
}

// 2. Описываем структуру всего data.json
export interface PluginData {
    settings: {
        viewMode: 'scroll' | 'single';
        language: "ru" | "en"
    };
    library: { [path: string]: MangaProgress };
    defaultLibraryPath: string; // Путь внутри Vault по умолчанию
    externalSources: string[]; // Массив путей к внешним папкам
}

// 3. Дефолтные значения для инициализации плагина
export const DEFAULT_DATA: PluginData = {
    settings: {
        viewMode: 'scroll',
        language: "ru"
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
export interface ReaderPageLayout {
    index: number;
    chapterKey: string;
    chapterName: string;
    width: number;
    height: number;
    aspectRatio: number;
    mimeType: string;
    renderedWidth: number;
    renderedHeight: number;
    offsetTopInChapter: number;
    offsetBottomInChapter: number;
    chapterOffsetTop: number;
    offsetTopInReader: number;
    offsetBottomInReader: number;
}

export interface ReaderLayout {
    chapters: ChapterLayout[];
    pages: ReaderPageLayout[];
    totalHeight: number;
}

// --- Версии кэша ---
export const CURRENT_IMAGE_INDEX_SCHEMA_VERSION = 1;
export const CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION = 1;
