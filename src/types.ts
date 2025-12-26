// Это «контракт», описывающий структуру данных. 
// Так удобнее, чем держать это в голове.

export interface MangaProgress {
    lastChapter: string;
    lastPage: number;
    title?: string;      // Описание
    tags?: string[];     // Жанры
    notes?: string;      // Личные комментарии
}

export interface PluginData {
    settings: {
        viewMode: 'scroll' | 'single-page';
    };
    library: Record<string, MangaProgress>; // Ключом будет путь к папке манги
}

export const DEFAULT_DATA: PluginData = {
    settings: {
        viewMode: 'scroll'
    },
    library: {}
};