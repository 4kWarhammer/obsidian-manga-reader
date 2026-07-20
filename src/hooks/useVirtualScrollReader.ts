import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import {
    CachedChapterIndex,
    ChapterLayout,
    ReaderAnchor,
    ReaderLayout,
    ReaderPageLayout,
    VisibleRange,
} from "src/types";
import {
    buildChapterLayout,
    buildReaderLayout,
    findPageByOffset,
    getVisibleRange,
} from "src/utils/ReaderLayoutBuilder";
import {
    createChapterIndexerOptions,
    createChapterKey,
} from "src/utils/ChapterIndexHelpers";
import { ChapterIndexerProgress } from "src/utils/indexTypes";
import { logger } from "src/utils/logger";

export interface UseVirtualScrollReaderOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    anchor: ReaderAnchor;
    allChapters: string[];
    viewportWidth: number;
    viewportHeight: number;
    pageGap: number;
    maxPageWidth?: number;
    overscan?: number;
}

export interface UseVirtualScrollReaderResult {
    readerLayout: ReaderLayout | null;
    activePage: ReaderPageLayout | null;
    visibleRange: VisibleRange;
    visiblePages: ReaderPageLayout[];
    isLoading: boolean;
    error: string | null;
    indexingProgress: ChapterIndexerProgress | null;
    onScroll: (scrollTop: number, clientHeight?: number) => void;
    // Для якорения в момент resize
    pendingScrollTop: number | null;
    ackPendingScroll: () => void;
}

 // тут если индекс меньше 3 - добавляем педыдущую главу
const tresholdForPrev = 3;

/**
 * Хук управления virtual DOM. Выдает Layout для отрисовки
 * Дает информацию о текущей и соседней странице 
 * Это индексатор + layout-движок пока только для vertical scroll
 */
export function useVirtualScrollReader(
    options: UseVirtualScrollReaderOptions
): UseVirtualScrollReaderResult {
    const {
        app,
        plugin,
        parentPath,
        anchor,
        allChapters,
        viewportWidth,
        viewportHeight,
        pageGap,
        maxPageWidth,
        overscan = 1000,
    } = options;

    const anchorChapterName = anchor.chapterName;
    const anchorPageIndex = anchor.pageIndex;

    const readerLayoutRef = React.useRef<ReaderLayout | null>(null);
    const activePageRef = React.useRef<ReaderPageLayout | null>(null);
    const viewportHeightRef = React.useRef(viewportHeight);
    const scrollTopRef = React.useRef(0);
    const mountedRef = React.useRef(true);


    /**
     * Защита от повторной фоновой индексации одной и той же главы.
     */
    const loadingChapterKeysRef = React.useRef<Set<string>>(new Set());

    /**
     * Ключ стартовой главы. Нужен, чтобы initialPage применялся только
     * А может просто сделать boolean флаг для разовой активации в начале???
     */
    const initialAnchorKeyRef = React.useRef<string | null>(null);

    /**
     * Индексы глав.
     *
     * key: chapterKey
     * value: CachedChapterIndex
     */
    const [chapterIndexes, setChapterIndexes] = React.useState<Map<string, CachedChapterIndex>>(
        () => new Map()
    );

    const chapterIndexesRef = React.useRef<Map<string, CachedChapterIndex>>(chapterIndexes);

    /**
     * Список глав, которые должны присутствовать в ReaderLayout.
     */
    const [desiredChapterNames, setDesiredChapterNames] = React.useState<string[]>([]);

    const [readerLayout, setReaderLayout] = React.useState<ReaderLayout | null>(null);
    const [activePage, setActivePage] = React.useState<ReaderPageLayout | null>(null);
    const [visibleRange, setVisibleRange] = React.useState<VisibleRange>({ start: 0, end: 0 });

    /**
     * Флаг для загрузки/индексации текущей главы.
     */
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [indexingProgress, setIndexingProgress] =
        React.useState<ChapterIndexerProgress | null>(null);

    /**
     * Значение для корректировки положения экрана
     */
    const [pendingScrollTop, setPendingScrollTop] = React.useState<number | null>(null);


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

    // Синхронизируем отдельно Ref и State для readerLayout и activePage
    React.useEffect(() => {
        readerLayoutRef.current = readerLayout;
    }, [readerLayout]);

    React.useEffect(() => {
        activePageRef.current = activePage;
    }, [activePage]);

    React.useEffect(() => {
        viewportHeightRef.current = viewportHeight;
    }, [viewportHeight]);

    React.useEffect(() => {
        chapterIndexesRef.current = chapterIndexes;
    }, [chapterIndexes]);

    // Добавляем mountedRef
    React.useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);



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
        setDesiredChapterNames([anchorChapterName]);

        initialAnchorKeyRef.current = null;
        scrollTopRef.current = 0;

        logger.virtualManager(
            `Virtual desired window reset for "${anchorChapterName}"`
        );
    }, [
        allChaptersKey,
        anchorChapterName,
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
                    chapterName: anchorChapterName,
                });

                const indexManager = plugin.getChapterIndexManager();

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
        anchorChapterName,
    ]);

    // ============================================================
    // Effect A2: desired neighbor indexes, background
    // ============================================================

    /**
     * Fallback, если извне нужные соседние главы не были проиндексированы,
     * добавит в очередь для ChapterIndexManager с нужным приоритетом
     *
     * Важно: НЕ включает isLoading и не блокирует Reader
     */
    React.useEffect(() => {
        let cancelled = false;

        const indexDesiredChapters = async () => {
            if (desiredChapterNames.length === 0) return;

            const indexManager = plugin.getChapterIndexManager();

            // Собираем задачи параллельно, а не последовательно
            const tasks = desiredChapterNames
                .filter(targetChapterName => targetChapterName !== anchorChapterName)
                .map(targetChapterName => {
                    const opts = createChapterIndexerOptions({
                        app,
                        parentPath,
                        chapterName: targetChapterName,
                    });

                    if (chapterIndexesRef.current.has(opts.chapterKey)) {
                        return null;
                    }

                    if (loadingChapterKeysRef.current.has(opts.chapterKey)) {
                        return null;
                    }

                    loadingChapterKeysRef.current.add(opts.chapterKey);

                    return indexManager
                        .getOrBuildIndex(opts, 1)
                        .then(index => ({ chapterKey: opts.chapterKey, index }))
                        .catch(err => {
                            logger.error(
                                `useVirtualScrollReader: failed to index desired chapter "${targetChapterName}"`,
                                err
                            );
                            return null;
                        })
                        .finally(() => {
                            loadingChapterKeysRef.current.delete(opts.chapterKey);
                        });
                })
                .filter(Boolean) as Promise<{ chapterKey: string; index: CachedChapterIndex } | null>[];

            if (tasks.length === 0) return;

            const results = await Promise.all(tasks);

            if (cancelled) return;
            if (!mountedRef.current) return;

            const nextMap = new Map(chapterIndexesRef.current);

            for (const item of results) {
                if (item && !nextMap.has(item.chapterKey)) {
                    nextMap.set(item.chapterKey, item.index);
                }
            }

            setChapterIndexes(nextMap);
        };

        indexDesiredChapters();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        anchorChapterName,
        desiredChaptersKey,
    ]);

    // ============================================================
    // Effect B: chapterIndexes + layout options -> readerLayout
    // ============================================================

    /**
     * Строим ReaderLayout из desired chapters
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

            if (!index) {
                // Missing chapter at the start (e.g. prev not yet indexed) — skip and keep looking.
                // Missing in the middle/end — stop, we can't compute offsets beyond this point.
                if (layouts.length === 0) continue;
                break;
            }

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

        // ============================================================
        // Выставляем положение окна
        // ============================================================

        // При первичном открытии - на InitialPage
        const anchorKey = getChapterIndexKey(anchorChapterName);
        const anchorStateKey = `${anchorKey}:${anchorPageIndex}`;
        const isInitialAnchoring = initialAnchorKeyRef.current !== anchorStateKey;

        if (isInitialAnchoring) {
            const initialPageLayout =
                nextReaderLayout.pages.find(page =>
                    page.chapterKey === anchorKey &&
                    page.index === anchorPageIndex
                ) ??
                nextReaderLayout.pages.find(page =>
                    page.chapterKey === anchorKey
                ) ??
                nextReaderLayout.pages[0] ??
                null;

            scrollTopRef.current = initialPageLayout?.offsetTopInReader ?? 0;
            setPendingScrollTop(scrollTopRef.current);
            initialAnchorKeyRef.current = anchorStateKey;
        } else {
            // Якоримся при изменении viewportWidth
            const prevLayout = readerLayoutRef.current;
            const prevScrollTop = scrollTopRef.current;
            const prevViewportHeight = viewportHeightRef.current;
            const nextViewportHeight = viewportHeight;

            const anchoredScrollTop = computeAnchoredScrollTop(
                prevLayout,
                nextReaderLayout,
                prevScrollTop,
                prevViewportHeight,
                nextViewportHeight
            );

            if (anchoredScrollTop !== null) {
                scrollTopRef.current = anchoredScrollTop;
                setPendingScrollTop(anchoredScrollTop);
            }
        }

        // Обновляем VisibleRange 
        // когда делаем prepend
        if (viewportHeight > 0) {
            updateVisibleState(
                nextReaderLayout,
                scrollTopRef.current,
                viewportHeight
            );
        }

        readerLayoutRef.current = nextReaderLayout;
        setReaderLayout(nextReaderLayout);
    }, [
        chapterIndexes,
        desiredChaptersKey,
        viewportWidth,
        pageGap,
        maxPageWidth,
        anchorChapterName,
        anchorPageIndex,
        getChapterIndexKey,
    ]);

    // ============================================================
    // Effect C: readerLayout + viewportHeight + overscan + scrollTop
    //           -> visibleRange / activePage
    // ============================================================

    /**
     * При изменении layout или viewportHeight - пересчитываем
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
    // Desired window management
    // ============================================================

    /**
     * Единый эффект управления окном глав.
     * - append next: когда активная глава сменилась или открыли ридер.
     * - prepend prev: когда пользователь близок к началу текущей главы.
     *
     * Никакой индексации здесь нет — только desiredChapterNames.
     * Fallback-индексация отсутствующих глав выполняется Effect A2.
     */
    React.useEffect(() => {
        const activeChapterName = activePage?.chapterName ?? anchorChapterName;
        const activePageIndex = activePage?.index ?? anchorPageIndex;

        const nextChapterName = getNextChapterName(allChapters, activeChapterName);
        const prevChapterName = getPreviousChapterName(allChapters, activeChapterName);

        setDesiredChapterNames(prev => {
            let next = prev;

            if (nextChapterName && !next.includes(nextChapterName)) {
                next = addSorted(next, nextChapterName, allChapters);
            }

            if (
                prevChapterName &&
                !next.includes(prevChapterName) &&
                activePageIndex <= tresholdForPrev
            ) {
                next = addSorted(next, prevChapterName, allChapters);
            }

            if (next !== prev) {
                logger.virtualManager(
                    `Virtual desired window: ${next.join(", ")}`
                );
            }

            return next;
        });
    }, [
        activePage?.chapterName,
        activePage?.index,
        anchorChapterName,
        anchorPageIndex,
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

    // Для выполнения извне
    const ackPendingScroll = React.useCallback(() => {
        setPendingScrollTop(null);
    }, []);

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
        pendingScrollTop,
        ackPendingScroll,
    };
}

// ============================================================
// Helpers
// ============================================================

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

function computeAnchoredScrollTop(
    prevLayout: ReaderLayout | null,
    nextLayout: ReaderLayout,
    prevScrollTop: number,
    prevViewportHeight: number,
    nextViewportHeight: number
): number | null {
    if (!prevLayout || prevLayout.pages.length === 0 || nextLayout.pages.length === 0) {
        return null;
    }

    const previousAnchorOffset = prevScrollTop + prevViewportHeight / 2;

    const previousPage = findPageByOffset(
        prevLayout.pages,
        previousAnchorOffset
    );

    if (!previousPage) {
        return null;
    }

    const nextPage = nextLayout.pages.find(page =>
        page.chapterKey === previousPage.chapterKey &&
        page.index === previousPage.index
    );

    if (!nextPage) {
        return null;
    }

    const offsetInsidePage = previousAnchorOffset - previousPage.offsetTopInReader;

    const ratio = previousPage.renderedHeight > 0
        ? offsetInsidePage / previousPage.renderedHeight
        : 0;

    const clampedRatio = Math.max(0, Math.min(1, ratio));

    const nextAnchorOffset =
        nextPage.offsetTopInReader + nextPage.renderedHeight * clampedRatio;

    const nextScrollTop = nextAnchorOffset - nextViewportHeight / 2;

    return Math.max(0, Math.min(
        nextScrollTop,
        Math.max(0, nextLayout.totalHeight - nextViewportHeight)
    ));
}

function getPreviousChapterName(
    allChapters: string[],
    chapterName: string
): string | null {
    if (allChapters.length === 0) {
        return null
    };

    const idx = allChapters.indexOf(chapterName);

    if (idx <= 0) {
        return null
    };
    return allChapters[idx - 1];
}

/**
 * Добавляет главу в массив, сохраняя порядок из allChapters.
 * Гарантирует, что desiredChapterNames всегда отсортирован.
 */
function addSorted(
    current: string[],
    chapter: string,
    allChapters: string[]
): string[] {
    if (current.includes(chapter)) {
        return current
    };
    const set = new Set([...current, chapter]);

    return allChapters.filter(c => set.has(c));
}