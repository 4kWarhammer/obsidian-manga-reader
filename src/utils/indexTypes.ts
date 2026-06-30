// Это файл с типами второго уровня
// Условный types.ts не знает про него

import { App } from 'obsidian';

// ============================================================
// Опции и прогресс
// ============================================================

export interface ChapterIndexerOptions {
    chapterKey: string;
    titleKey: string;
    parentPath: string;
    chapterName: string;
    isArchive: boolean;
    isExternal: boolean;
    app: App;
    signal?: AbortSignal;
}

export interface ChapterIndexerProgress {
    loaded: number;
    total: number;
    currentFile?: string;
}

// ============================================================
// Интерфейс адаптера для работы с файловой системой
// Позволяет абстрагироваться от Obsidian API / Node fs
// ============================================================

export interface CacheStorageAdapter {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
}