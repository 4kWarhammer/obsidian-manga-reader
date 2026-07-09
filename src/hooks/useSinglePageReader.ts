import * as React from "react";
import { App } from "obsidian";
import type MangaReaderPlugin from "../main";
import {
    ReaderAnchor,
    ReaderLayout,
    ReaderPageLayout,
} from "src/types";
import { createChapterIndexerOptions } from "src/utils/ChapterIndexHelpers";
import { logger } from "src/utils/logger";

export interface UseSinglePageReaderOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    allChapters: string[];
    readerLayout: ReaderLayout | null;
    anchor: ReaderAnchor;
    onAnchorChange: (anchor: ReaderAnchor) => void;
    onProgressSave: (pageIndex: number, chapterName: string) => void;
}

export interface UseSinglePageReaderResult {
    page: ReaderPageLayout | null;
    chapterName: string;
    pageIndex: number;
    totalPages: number;
    isReady: boolean;
    goToPage: (pageIndex: number) => Promise<void>;
    goToChapter: (chapterName: string, pageIndex?: number) => Promise<void>;
}

export function useSinglePageReader({
    app,
    plugin,
    parentPath,
    allChapters,
    readerLayout,
    anchor,
    onAnchorChange,
    onProgressSave,
}: UseSinglePageReaderOptions): UseSinglePageReaderResult {
    const page = React.useMemo(() => {
        if (!readerLayout) {
            return null;
        }

        return readerLayout.pages.find(candidate =>
            candidate.chapterName === anchor.chapterName &&
            candidate.index === anchor.pageIndex
        ) ?? null;
    }, [
        readerLayout,
        anchor.chapterName,
        anchor.pageIndex,
    ]);

    const totalPages = React.useMemo(() => {
        if (!readerLayout) {
            return 0;
        }

        const chapter = readerLayout.chapters.find(chapter =>
            chapter.chapterName === anchor.chapterName
        );

        return chapter?.pages.length ?? 0;
    }, [
        readerLayout,
        anchor.chapterName,
    ]);

    const goToChapter = React.useCallback(async (
        chapterName: string,
        pageIndex = 0
    ) => {
        const safePageIndex = Math.max(0, pageIndex);

        onAnchorChange({
            chapterName,
            pageIndex: safePageIndex,
        });

        onProgressSave(safePageIndex, chapterName);

        logger.virtualManager(
            `Single reader moved to ${chapterName} #${safePageIndex + 1}`
        );
    }, [
        onAnchorChange,
        onProgressSave,
    ]);

    const goToPage = React.useCallback(async (targetPageIndex: number) => {
        if (targetPageIndex >= totalPages) {
            const currentChapterIndex = allChapters.indexOf(anchor.chapterName);
            const nextChapter = allChapters[currentChapterIndex + 1];

            if (!nextChapter) {
                return;
            }

            await goToChapter(nextChapter, 0);
            return;
        }

        if (targetPageIndex < 0) {
            const currentChapterIndex = allChapters.indexOf(anchor.chapterName);
            const previousChapter = allChapters[currentChapterIndex - 1];

            if (!previousChapter) {
                return;
            }

            const opts = createChapterIndexerOptions({
                app: plugin.app,
                parentPath,
                chapterName: previousChapter,
            });

            const previousIndex = await plugin
                .getChapterIndexManager()
                .getOrBuildIndex(opts, 1);

            await goToChapter(
                previousChapter,
                Math.max(0, previousIndex.pageCount - 1)
            );

            return;
        }

        await goToChapter(anchor.chapterName, targetPageIndex);
    }, [
        allChapters,
        anchor.chapterName,
        goToChapter,
        parentPath,
        plugin,
        totalPages,
    ]);

    return {
        page,
        chapterName: anchor.chapterName,
        pageIndex: anchor.pageIndex,
        totalPages,
        isReady: Boolean(page),
        goToPage,
        goToChapter,
    };
}