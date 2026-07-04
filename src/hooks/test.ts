import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import {
    CachedChapterIndex,
    ChapterLayout,
    ReaderLayout,
    ReaderPageLayout,
} from "src/types";
import {
    buildChapterLayout,
    buildReaderLayout,
    findPageByOffset,
    getVisibleRange,
    VisibleRange,
} from "src/utils/ReaderLayoutBuilder";
import {
    createChapterIndexerOptions,
    createChapterKey,
} from "src/utils/ChapterIndexHelpers";
import { ChapterIndexerProgress } from "src/utils/indexTypes";
import { logger } from "src/utils/logger";

export interface UseVirtualMangaReaderOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    chapterName: string;
    allChapters: string[];
    viewportWidth: number;
    viewportHeight: number;
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
        allChapters,
        viewportWidth,
        viewportHeight,
        pageGap,
        maxPageWidth,
        initialPage = 0,
        overscan = 1000,
    } = options;

    /**
     * Индексы глав.
     *
     * key: chapterKey
     * value: CachedChapterIndex
     */
    const [chapterIndexes, setChapterIndexes] = React.useState<Map<string, CachedChapterIndex>>(
        () => new Map()
    );

    /**
     * Список глав, которые должны присутствовать в ReaderLayout.
     *
     * На первом этапе:
     * [current, next]
     *
     * Потом при переходе activePage в next:
     * [current, next, nextNext]
     */
    const [desiredChapterNames, setDesiredChapterNames] = React.useState<string[]>([]);

    const [readerLayout, setReaderLayout] = React.useState<ReaderLayout | null>(null);
    const [activePage, setActivePage] = React.useState<ReaderPageLayout | null>(null);
    const [visibleRange, setVisibleRange] = React.useState<VisibleRange>({ start: 0, end: 0 });

    /**
     * isLoading здесь означает именно загрузку/индексацию текущей главы.
     *
     * Background indexing соседей не должен включать глобальный loader.
     */
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [indexingProgress, setIndexingProgress] =
        React.useState<ChapterIndexerProgress | null>(null);

    /**
     * Текущий scrollTop virtual reader-а.
     *
     * Нужен, чтобы пересчитывать activePage/visibleRange
     * после изменения readerLayout или viewportHeight.
     */
    const scrollTopRef = React.useRef(0);

    /**
     * Защита от повторной фоновой индексации одной и той же главы.
     */
    const loadingChapterKeysRef = React.useRef<Set<string>>(new Set());

    /**
     * Ключ стартовой главы. Нужен, чтобы initialPage применялся только
     * при открытии новой главы, а не при каждом пересчёте layout.
     */
    const initialAnchorKeyRef = React.useRef<string | null>(null);

    const allChaptersKey = React.useMemo(() => {
        return allChapters.join("\u0000");
    }, [allChapters]);

    const desiredChaptersKey = React.useMemo(() => {
        return desiredChapterNames.join("\u0000");
    }, [desiredChapterNames]);

    // ============================================================
    // Helpers
    // ============================================================

    /**
     * Helper, чисто ключ создать к одной главе
     */
    const getChapterIndexKey = React.useCallback(
        (targetChapterName: string): string => {
            return createChapterKey(parentPath, targetChapterName);
        },
        [parentPath]
    );

    const updateVisibleState = React.useCallback((
        layout: ReaderLayout,
        scrollTop: number,
        clientHeight: number
    ) => {
        const viewportCenter = scrollTop + clientHeight / 2;

        const nextActivePage = findPageByOffset(
            layout.pages,
            viewportCenter
        );

        const nextVisibleRange = getVisibleRange(
            layout,
            scrollTop,
            clientHeight,
            overscan
        );

        setActivePage(prev => {
            const isSame =
                prev?.chapterKey === nextActivePage?.chapterKey &&
                prev?.index === nextActivePage?.index;

            return isSame ? prev : nextActivePage;
        });

        setVisibleRange(prev => {
            const isSame =
                prev.start === nextVisibleRange.start &&
                prev.end === nextVisibleRange.end;

            return isSame ? prev : nextVisibleRange;
        });
    }, [overscan]);

    // ============================================================
    // Desired chapters initialization
    // ============================================================

    /**
     * При смене стартовой главы сбрасываем layout window:
     * current + next.
     *
     * Это не индексирует главы само по себе.
     * Это только говорит hook-у: "эти главы должны быть в layout".
     */
    React.useEffect(() => {
        const initialWindow = getInitialForwardWindow(allChapters, chapterName);

        setDesiredChapterNames(initialWindow);

        const anchorKey = getChapterIndexKey(chapterName);
        initialAnchorKeyRef.current = null;
        scrollTopRef.current = 0;

        logger.ReaderPage(
            `Virtual desired chapters reset for "${chapterName}": ${initialWindow.join(", ")}`
        );
    }, [
        allChaptersKey,
        chapterName,
        getChapterIndexKey,
    ]);

    // ============================================================
    // Effect A1: current chapter index, blocking
    // ============================================================

    /**
     * Текущая глава индексируется с priority 0.
     * Только этот процесс включает isLoading.
     */
    React.useEffect(() => {
        let cancelled = false;

        const buildCurrentIndex = async () => {
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

                setChapterIndexes(prev => {
                    const next = new Map(prev);
                    next.set(opts.chapterKey, index);
                    return next;
                });
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

        buildCurrentIndex();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        chapterName,
    ]);

    // ============================================================
    // Effect A2: desired neighbor indexes, background
    // ============================================================

    /**
     * Все desired chapters кроме текущей индексируются в фоне.
     *
     * Например:
     * current ch.1 уже готов priority 0
     * next ch.2 уйдёт сюда priority 1
     *
     * Важно: это НЕ включает isLoading.
     */
    React.useEffect(() => {
        let cancelled = false;

        const indexDesiredChapters = async () => {
            if (desiredChapterNames.length === 0) return;

            const indexManager = plugin.getChapterIndexManager();

            for (const targetChapterName of desiredChapterNames) {
                if (targetChapterName === chapterName) {
                    continue;
                }

                const opts = createChapterIndexerOptions({
                    app,
                    parentPath,
                    chapterName: targetChapterName,
                });

                if (chapterIndexes.has(opts.chapterKey)) {
                    continue;
                }

                if (loadingChapterKeysRef.current.has(opts.chapterKey)) {
                    continue;
                }

                loadingChapterKeysRef.current.add(opts.chapterKey);

                try {
                    const index = await indexManager.getOrBuildIndex(
                        opts,
                        1
                    );

                    if (cancelled) return;

                    setChapterIndexes(prev => {
                        const next = new Map(prev);
                        next.set(opts.chapterKey, index);
                        return next;
                    });
                } catch (err) {
                    logger.error(
                        `useVirtualMangaReader: failed to index desired chapter "${targetChapterName}"`,
                        err
                    );
                } finally {
                    loadingChapterKeysRef.current.delete(opts.chapterKey);
                }
            }
        };

        indexDesiredChapters();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        chapterName,
        desiredChaptersKey,
        chapterIndexes,
    ]);

    // ============================================================
    // Effect B: chapterIndexes + layout options -> readerLayout
    // ============================================================

    /**
     * Строим ReaderLayout из тех desired chapters,
     * чьи CachedChapterIndex уже готовы.
     *
     * Это лёгкая frontend-операция.
     * Она не включает isLoading.
     */
    React.useEffect(() => {
        if (viewportWidth <= 0) return;

        if (desiredChapterNames.length === 0) {
            setReaderLayout(null);
            return;
        }

        const layouts: ChapterLayout[] = [];

        for (const targetChapterName of desiredChapterNames) {
            const chapterKey = getChapterIndexKey(targetChapterName);
            const index = chapterIndexes.get(chapterKey);


            // Если какой то индекс ещё не готов — просто пропускаем.
            if (!index) continue;

            layouts.push(
                buildChapterLayout(index, targetChapterName, {
                    containerWidth: viewportWidth,
                    pageGap,
                    maxPageWidth,
                })
            );
        }

        if (layouts.length === 0) {
            setReaderLayout(null);
            return;
        }

        const nextReaderLayout = buildReaderLayout(layouts);

        /**
         * Применяем initialPage только один раз на открытую главу.
         */
        const anchorKey = getChapterIndexKey(chapterName);

        if (initialAnchorKeyRef.current !== anchorKey) {
            const initialPageLayout =
                nextReaderLayout.pages.find(page =>
                    page.chapterKey === anchorKey &&
                    page.index === initialPage
                ) ??
                nextReaderLayout.pages.find(page =>
                    page.chapterKey === anchorKey
                ) ??
                nextReaderLayout.pages[0] ??
                null;

            scrollTopRef.current = initialPageLayout?.offsetTopInReader ?? 0;
            initialAnchorKeyRef.current = anchorKey;
        }

        setReaderLayout(nextReaderLayout);
    }, [
        chapterIndexes,
        desiredChaptersKey,
        viewportWidth,
        pageGap,
        maxPageWidth,
        chapterName,
        initialPage,
        getChapterIndexKey,
    ]);

    // ============================================================
    // Effect C: readerLayout + viewportHeight + overscan + scrollTop
    //           -> visibleRange / activePage
    // ============================================================

    /**
     * При изменении layout или viewportHeight пересчитываем
     * visibleRange и activePage по текущему scrollTop.
     *
     * Это не должно запускать indexing и не должно включать loading.
     */
    React.useEffect(() => {
        if (!readerLayout) return;
        if (viewportHeight <= 0) return;

        updateVisibleState(
            readerLayout,
            scrollTopRef.current,
            viewportHeight
        );
    }, [
        readerLayout,
        viewportHeight,
        updateVisibleState,
    ]);

    // ============================================================
    // Ensure next chapter when active chapter changes
    // ============================================================

    /**
     * Когда activePage переходит в новую главу,
     * гарантируем, что следующая глава добавлена в desiredChapterNames.
     *
     * Это не ждёт конца главы.
     * Активная глава сменилась -> добавили next.
     */
    React.useEffect(() => {
        const activeChapterName = activePage?.chapterName ?? chapterName;

        const nextChapterName = getNextChapterName(
            allChapters,
            activeChapterName
        );

        if (!nextChapterName) {
            return;
        }

        setDesiredChapterNames(prev => {
            if (prev.includes(nextChapterName)) {
                return prev;
            }

            return [...prev, nextChapterName];
        });
    }, [
        activePage?.chapterName,
        chapterName,
        allChaptersKey,
    ]);

    // ============================================================
    // Scroll handler API
    // ============================================================

    const onScroll = React.useCallback((
        scrollTop: number,
        nextClientHeight?: number
    ) => {
        if (!readerLayout) return;

        scrollTopRef.current = scrollTop;

        const clientHeight = nextClientHeight ?? viewportHeight;

        updateVisibleState(
            readerLayout,
            scrollTop,
            clientHeight
        );
    }, [
        readerLayout,
        viewportHeight,
        updateVisibleState,
    ]);

    const visiblePages = React.useMemo(() => {
        if (!readerLayout) return [];

        return readerLayout.pages.slice(
            visibleRange.start,
            visibleRange.end
        );
    }, [
        readerLayout,
        visibleRange,
    ]);

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

// ============================================================
// Helpers
// ============================================================

function getInitialForwardWindow(
    allChapters: string[],
    chapterName: string
): string[] {
    if (allChapters.length === 0) {
        return [chapterName];
    }

    const currentIndex = allChapters.indexOf(chapterName);

    if (currentIndex === -1) {
        return [chapterName];
    }

    const result = [chapterName];

    const next = allChapters[currentIndex + 1];

    if (next) {
        result.push(next);
    }

    return result;
}

function getNextChapterName(
    allChapters: string[],
    chapterName: string
): string | null {
    if (allChapters.length === 0) {
        return null;
    }

    const currentIndex = allChapters.indexOf(chapterName);

    if (currentIndex === -1) {
        return null;
    }

    if (currentIndex >= allChapters.length - 1) {
        return null;
    }

    return allChapters[currentIndex + 1];
}