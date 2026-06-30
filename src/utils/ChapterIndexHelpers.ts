import { App } from 'obsidian';
import { ChapterIndexerOptions } from './indexTypes';

/**
 * Helper, помогает получить базовую информацию о главе
 */
export function createChapterIndexerOptions(params: {
    app: App;
    parentPath: string;
    chapterName: string;
    titleKey?: string;
    signal?: AbortSignal;
}): ChapterIndexerOptions {
    const { app, parentPath, chapterName, titleKey, signal } = params;

    return {
        chapterKey: createChapterKey(parentPath, chapterName),
        titleKey: titleKey ?? parentPath,
        parentPath,
        chapterName,
        isArchive: isArchiveChapter(chapterName),
        isExternal: isExternalPath(parentPath),
        app,
        signal,
    };
}

export function createChapterKey(parentPath: string, chapterName: string): string {
    return `${parentPath}::${chapterName}`;
}

export function isArchiveChapter(chapterName: string): boolean {
    return chapterName.endsWith('.zip') || chapterName.endsWith('.cbz');
}

export function isExternalPath(parentPath: string): boolean {
    return parentPath.includes(":\\") || parentPath.startsWith("/");
}