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

// 2. Описываем структуру всего data.json
export interface PluginData {
    settings: {
        viewMode: 'scroll' | 'single-page';
    };
    library: { [path: string]: MangaProgress };
    defaultLibraryPath: string; // Путь внутри Vault по умолчанию
    externalSources: string[]; // Массив путей к внешним папкам
}

// 3. Дефолтные значения для инициализации плагина
export const DEFAULT_DATA: PluginData = {
    settings: {
        viewMode: 'scroll'
    },
    library: {},
    defaultLibraryPath: "",
    externalSources: []
};