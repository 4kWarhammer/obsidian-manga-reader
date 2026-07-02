// Для Будущего рефакторинга нужно будет разделить логику:
// Effect A:
//   chapter changed -> getOrBuildIndex -> setChapterIndex

// Memo/effect B:
//   chapterIndex + viewportWidth + pageGap + maxPageWidth -> readerLayout

// Effect C:
//   readerLayout + viewportHeight + overscan + scrollTop -> visibleRange/activePage

import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { ReaderLayout, ReaderPageLayout } from "src/types";
import {
    buildChapterLayout,
    buildReaderLayout,
    findPageByOffset,
    getVisibleRange,
    VisibleRange,
} from "src/utils/ReaderLayoutBuilder";
import { createChapterIndexerOptions } from "src/utils/ChapterIndexHelpers";
import { ChapterIndexerProgress } from "src/utils/indexTypes";

export interface UseVirtualMangaReaderOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    chapterName: string;
    viewportWidth: number; // Ширина видимой области
    viewportHeight: number; // Высота видимой области, нужна для visible range / scroll math
    pageGap: number;
    maxPageWidth?: number;
    initialPage?: number;
    overscan?: number;
}

export interface UseVirtualMangaReaderResult {
    readerLayout: ReaderLayout | null;
    activePage: ReaderPageLayout | null;
    visibleRange: VisibleRange;
    visiblePages: ReaderPageLayout[];
    isLoading: boolean;
    error: string | null;
    indexingProgress: ChapterIndexerProgress | null;
    onScroll: (scrollTop: number, clientHeight?: number) => void;
}

export function useVirtualMangaReader(
    options: UseVirtualMangaReaderOptions
): UseVirtualMangaReaderResult {
    const {
        app,
        plugin,
        parentPath,
        chapterName,
        viewportWidth,
        viewportHeight,
        pageGap,
        maxPageWidth,
        initialPage = 0,
        overscan = 1000,
    } = options;

    const [readerLayout, setReaderLayout] = React.useState<ReaderLayout | null>(null);
    const [activePage, setActivePage] = React.useState<ReaderPageLayout | null>(null);
    const [visibleRange, setVisibleRange] = React.useState<VisibleRange>({ start: 0, end: 0 });
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Для отслеживания индексации
    const [indexingProgress, setIndexingProgress] = React.useState<ChapterIndexerProgress | null>(null);


    React.useEffect(() => {
        let cancelled = false;

        const build = async () => {
            if (viewportWidth <= 0) return;

            setIsLoading(true);
            setError(null);
            setIndexingProgress(null);

            try {
                const opts = createChapterIndexerOptions({
                    app,
                    parentPath,
                    chapterName,
                });

                const indexManager = plugin.getChapterIndexManager();

                indexManager.setCurrentChapter(opts.chapterKey);

                const index = await indexManager.getOrBuildIndex(
                    opts,
                    0,
                    progress => {
                        if (!cancelled) {
                            setIndexingProgress(progress);
                        }
                    }
                );

                if (cancelled) return;

                const chapterLayout = buildChapterLayout(index, chapterName, {
                    containerWidth: viewportWidth,
                    pageGap,
                    maxPageWidth,
                });

                const nextReaderLayout = buildReaderLayout([chapterLayout]);

                if (cancelled) return;

                const initialActivePage =
                    nextReaderLayout.pages[initialPage] ?? nextReaderLayout.pages[0] ?? null;

                const initialVisibleRange = getVisibleRange(
                    nextReaderLayout,
                    initialActivePage?.offsetTopInReader ?? 0,
                    viewportHeight,
                    overscan
                );

                setReaderLayout(nextReaderLayout);
                setActivePage(initialActivePage);
                setVisibleRange(initialVisibleRange);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        build();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        chapterName,
        viewportWidth,
        viewportHeight,
        pageGap,
        maxPageWidth,
        overscan,
    ]);

    const onScroll = React.useCallback((
        scrollTop: number,
        nextClientHeight?: number
    ) => {
        if (!readerLayout) return;

        const clientHeight = nextClientHeight ?? viewportHeight;
        const viewportCenter = scrollTop + clientHeight / 2;

        const nextActivePage = findPageByOffset(
            readerLayout.pages,
            viewportCenter
        );

        const nextVisibleRange = getVisibleRange(
            readerLayout,
            scrollTop,
            clientHeight,
            overscan
        );

        setActivePage(prev => {
            const isSame = prev?.chapterKey === nextActivePage?.chapterKey && prev?.index === nextActivePage?.index;
            return isSame ? prev : nextActivePage;
        });

        setVisibleRange(prev => {
            const isSame = prev.start === nextVisibleRange.start && prev.end === nextVisibleRange.end
            return isSame ? prev : nextVisibleRange;
        });
    }, [readerLayout, viewportHeight, overscan]);

    const visiblePages = React.useMemo(() => {
        if (!readerLayout) return [];

        return readerLayout.pages.slice(visibleRange.start, visibleRange.end);
    }, [readerLayout, visibleRange]);

    return {
        readerLayout,
        activePage,
        visibleRange,
        visiblePages,
        isLoading,
        error,
        indexingProgress,
        onScroll,
    };
}