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
