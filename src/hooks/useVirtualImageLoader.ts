import * as React from "react";
import { App } from "obsidian";
import { ReaderLayout, ReaderPageLayout, VirtualImageProvider } from "src/types";
import { ImageCache } from "src/utils/ImageCache";
import { ImageLoader } from "src/utils/ImageLoader";
import { isArchiveChapter } from "src/utils/ChapterIndexHelpers";
import { runWithConcurrency } from "src/utils/runWithConcurrency";
import { logger } from "src/utils/logger";

export interface UseVirtualImageLoaderOptions {
    app: App;
    parentPath: string;
    readerLayout: ReaderLayout | null;
    visiblePages: ReaderPageLayout[];
    activePage: ReaderPageLayout | null;

    // Сколько страниц удерживать до и после activePage внутри той же главы.
    retainBefore?: number;
    retainAfter?: number;

    // Насколько близко activePage должна подойти к краю retained range,
    // чтобы окно пересчиталось.
    retainEdgeThreshold?: number;

    // Сколько Blob URL загружать параллельно.
    loadConcurrency?: number;
}

interface ChapterLoaderEntry {
    loader: ImageLoader;
    cache: ImageCache;
}

interface RetainedRange {
    chapterName: string;
    start: number;
    end: number;
}

interface LoadedImageResult {
    key: string;
    url: string | null;
}

export function useVirtualImageLoader({
    app,
    parentPath,
    readerLayout,
    visiblePages,
    activePage,
    retainBefore = 6,
    retainAfter = 8,
    retainEdgeThreshold = 2,
    loadConcurrency = 2,
}: UseVirtualImageLoaderOptions): VirtualImageProvider {
    const [loadedUrls, setLoadedUrls] = React.useState<Map<string, string>>(
        () => new Map()
    );

    /**
     * State нужен, чтобы effects/useMemo реагировали на изменение retained range.
     * Ref нужен, чтобы быстро проверять актуальное окно без лишних deps.
     */
    const [retainedRange, setRetainedRange] =
        React.useState<RetainedRange | null>(null);

    const retainedRangeRef = React.useRef<RetainedRange | null>(null);

    const desiredKeysRef = React.useRef<Set<string>>(new Set());
    const mountedRef = React.useRef(true);

    const loadedUrlsRef = React.useRef<Map<string, string>>(new Map());
    const loadingSetRef = React.useRef<Set<string>>(new Set());
    const promiseMapRef = React.useRef<Map<string, Promise<string>>>(new Map());

    const chapterLoadersRef = React.useRef<Map<string, ChapterLoaderEntry>>(new Map());

    /**
     * Для visible pages отдельно строим key set:
     * они имеют самый высокий приоритет для загрузки.
     */
    const visibleKeys = React.useMemo(() => {
        const keys = new Set<string>();

        for (const page of visiblePages) {
            keys.add(createImageKey(page.chapterName, page.index));
        }

        return keys;
    }, [visiblePages]);

    const effectiveRetainedRange = React.useMemo(() => {
        if (!readerLayout || !activePage) {
            return retainedRange;
        }

        // Тут оператор проверки на пустоту. Если левая часть есть - возвращает
        // Если нету (null, undefined) - выполняет функцию из правой части
        return retainedRange ?? buildRetainedRange(
            readerLayout,
            activePage,
            retainBefore,
            retainAfter
        );
    }, [
        readerLayout,
        activePage,
        retainedRange,
        retainBefore,
        retainAfter,
    ]);

    // Эффект для переопределения retained range
    React.useEffect(() => {
        if (!readerLayout) return;
        if (!activePage) return;

        const currentRange = retainedRangeRef.current;

        const shouldRecenter = shouldRecenterRetainedRange(
                activePage,
                currentRange,
                retainEdgeThreshold
            )
            
        if (!shouldRecenter) {
            return;
        }

        const nextRange = buildRetainedRange(
            readerLayout,
            activePage,
            retainBefore,
            retainAfter
        );

        retainedRangeRef.current = nextRange;
        setRetainedRange(nextRange);

        logger.virtualManager(
            `Virtual image retained range: ${nextRange.chapterName} [${nextRange.start}-${nextRange.end}]`
        );
    }, [
        readerLayout,
        activePage,
        retainBefore,
        retainAfter,
        retainEdgeThreshold,
    ]);

    /**
     * desiredKeys = то, что нужно держать в памяти:
     * 1. Все видимые страницы.
     * 2. Retained range вокруг activePage.
     */
    const desiredKeys = React.useMemo(() => {
        const keys = new Set<string>(visibleKeys);

        if (readerLayout && effectiveRetainedRange) {
            for (const page of readerLayout.pages) {
                if (page.chapterName !== effectiveRetainedRange.chapterName) {
                    continue;
                }

                if (
                    page.index >= effectiveRetainedRange.start &&
                    page.index <= effectiveRetainedRange.end
                ) {
                    keys.add(createImageKey(page.chapterName, page.index));
                }
            }
        }

        return keys;
    }, [
        readerLayout,
        effectiveRetainedRange,
        visibleKeys,
    ]);

    const desiredKeysKey = React.useMemo(() => {
        return Array.from(desiredKeys).sort().join("\u0000");
    }, [desiredKeys]);

    /**
     * Подключает к главе ImageCache и ImageLoader
     */
    const getChapterLoader = React.useCallback((chapterName: string): ChapterLoaderEntry => {
        const existing = chapterLoadersRef.current.get(chapterName);

        if (existing) {
            return existing;
        }

        const cache = new ImageCache();

        const loader = new ImageLoader(
            parentPath,
            chapterName,
            cache,
            isArchiveChapter(chapterName),
            false,
            app
        );

        const entry = {
            loader,
            cache,
        };

        chapterLoadersRef.current.set(chapterName, entry);

        return entry;
    }, [
        app,
        parentPath,
    ]);

    const releasePage = React.useCallback((chapter: string, index: number): void => {
        const key = createImageKey(chapter, index);

        const hadLoaded = loadedUrlsRef.current.has(key);
        const hadLoading = loadingSetRef.current.has(key);
        const hadPromise = promiseMapRef.current.has(key);

        if (!hadLoaded && !hadLoading && !hadPromise) {
            return;
        }

        const chapterEntry = chapterLoadersRef.current.get(chapter);

        if (chapterEntry) {
            chapterEntry.cache.release(index);
        }

        loadingSetRef.current.delete(key);
        promiseMapRef.current.delete(key);

        setLoadedUrls(prev => {
            if (!prev.has(key)) {
                return prev;
            }

            const next = new Map(prev);
            next.delete(key);
            loadedUrlsRef.current = next;
            return next;
        });

        logger.lazyLoader(`useVirtualImageLoader: released ${key}`);
    }, []);

    const isLoading = React.useCallback((chapter: string, index: number): boolean => {
        return loadingSetRef.current.has(createImageKey(chapter, index));
    }, []);

    const isInRange = React.useCallback((chapter: string, index: number): boolean => {
        return desiredKeys.has(createImageKey(chapter, index));
    }, [desiredKeys]);

    const clear = React.useCallback(() => {
        for (const [chapter, entry] of chapterLoadersRef.current.entries()) {
            entry.cache.clear();
            entry.loader.clear();
            logger.lazyLoader(`useVirtualImageLoader: cleared chapter ${chapter}`);
        }

        chapterLoadersRef.current.clear();
        loadingSetRef.current.clear();
        promiseMapRef.current.clear();
        retainedRangeRef.current = null;

        loadedUrlsRef.current = new Map();

        setRetainedRange(null);
        setLoadedUrls(new Map());
    }, []);

    React.useEffect(() => {
        return () => {
            clear();
        };
    }, [clear]);

    // Синхронизируем refs
    React.useEffect(() => {
        desiredKeysRef.current = desiredKeys;
    }, [desiredKeys]);

    React.useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    /**
     * Основной эффект загрузки / выгрузки Blob URL.
     *
     * Он реагирует на изменение desiredKeys,
     * но retained range меняется редко, поэтому загрузка/выгрузка
     * не будет дёргаться на каждое мелкое изменение visibleRange.
     */
    React.useEffect(() => {
        if (!readerLayout) {
            pruneLoadedUrlsToDesiredKeys(
                loadedUrlsRef.current,
                desiredKeys,
                releasePage
            );
            return;
        }

        const pagesToLoad = readerLayout.pages.filter(page => {
            const key = createImageKey(page.chapterName, page.index);

            if (!desiredKeys.has(key)) {
                return false;
            }

            if (loadedUrlsRef.current.has(key)) {
                return false;
            }

            if (promiseMapRef.current.has(key)) {
                return false;
            }

            return true;
        });

        pagesToLoad.sort((a, b) => {
            return (
                getLoadPriority(a, activePage, visibleKeys) -
                getLoadPriority(b, activePage, visibleKeys)
            );
        });

        if (pagesToLoad.length === 0) {
            pruneLoadedUrlsToDesiredKeys(
                loadedUrlsRef.current,
                desiredKeys,
                releasePage
            );

            return;
        }

        void runWithConcurrency(
            pagesToLoad,
            loadConcurrency,
            // 3. Функция загрузки отдельной страницы
            async page => {
                const key = createImageKey(page.chapterName, page.index);

                loadingSetRef.current.add(key);

                // Используем существующий промис или создаем новый
                let promise = promiseMapRef.current.get(key);
                if (!promise) {
                    const { loader } = getChapterLoader(page.chapterName);
                    promise = loader.load(page.index);
                    promiseMapRef.current.set(key, promise);
                }

                return { key, url: await promise };
            },
            // 4. Функция обработки результата загрузки, onItemDone
            (_index, result) => {
                const { key, url } = result;

                loadingSetRef.current.delete(key);
                promiseMapRef.current.delete(key);

                // Единая проверка: нужен ли этот ресурс сейчас
                const isNotNeeded = 
                !mountedRef.current ||
                !url ||
                !desiredKeysRef.current.has(key);

                if (isNotNeeded) {
                    const parsed = parseImageKey(key);
                    if (parsed && url) releasePage(parsed.chapter, parsed.index);
                    return;
                }

                setLoadedUrls(prev => {
                    if (prev.get(key) === url) {
                        return prev;
                    }

                    const next = new Map(prev);
                    next.set(key, url);
                    loadedUrlsRef.current = next;
                    return next;
                });
            }
        ).catch(error => {
            if (mountedRef.current) {
                logger.error(
                    "useVirtualImageLoader: failed to load desired images",
                    error
                );
            }
        }).finally(() => {
            if (mountedRef.current) {
                pruneLoadedUrlsToDesiredKeys(
                    loadedUrlsRef.current,
                    desiredKeysRef.current,
                    releasePage
                );
            }
        });
    }, [
        readerLayout,
        activePage,
        visibleKeys,
        desiredKeys,
        desiredKeysKey,
        loadConcurrency,
        getChapterLoader,
        releasePage,
    ]);

    return {
        loadedUrls,
        isLoading,
        isInRange,
        releasePage,
        clear,
    };
}

function createImageKey(chapter: string, index: number): string {
    return `${chapter}:${index}`;
}

function parseImageKey(key: string): { chapter: string; index: number } | null {
    const separatorIndex = key.lastIndexOf(":");

    if (separatorIndex === -1) {
        return null;
    }

    const chapter = key.slice(0, separatorIndex);
    const index = Number(key.slice(separatorIndex + 1));

    if (!chapter || Number.isNaN(index)) {
        return null;
    }

    return {
        chapter,
        index,
    };
}

function buildRetainedRange(
    readerLayout: ReaderLayout,
    activePage: ReaderPageLayout,
    retainBefore: number,
    retainAfter: number
): RetainedRange {
    let minIndex = activePage.index;
    let maxIndex = activePage.index;

    for (const page of readerLayout.pages) {
        if (page.chapterName !== activePage.chapterName) {
            continue;
        }

        if (page.index < minIndex) {
            minIndex = page.index;
        }

        if (page.index > maxIndex) {
            maxIndex = page.index;
        }
    }

    return {
        chapterName: activePage.chapterName,
        start: Math.max(minIndex, activePage.index - retainBefore),
        end: Math.min(maxIndex, activePage.index + retainAfter),
    };
}

function shouldRecenterRetainedRange(
    activePage: ReaderPageLayout,
    range: RetainedRange | null,
    edgeThreshold: number
): boolean {
    if (!range) {
        return true;
    }

    if (range.chapterName !== activePage.chapterName) {
        return true;
    }

    if (activePage.index <= range.start + edgeThreshold) {
        return true;
    }

    if (activePage.index >= range.end - edgeThreshold) {
        return true;
    }

    return false;
}

function getLoadPriority(
    page: ReaderPageLayout,
    activePage: ReaderPageLayout | null,
    visibleKeys: Set<string>
): number {
    const key = createImageKey(page.chapterName, page.index);

    if (visibleKeys.has(key)) {
        return 0;
    }

    if (!activePage) {
        return 1000 + page.index;
    }

    if (page.chapterName === activePage.chapterName) {
        return 10 + Math.abs(page.index - activePage.index);
    }

    return 500 + Math.abs(page.index - activePage.index);
}

function pruneLoadedUrlsToDesiredKeys(
    loadedUrls: Map<string, string>,
    desiredKeys: Set<string>,
    releasePage: (chapter: string, index: number) => void
): void {
    for (const key of Array.from(loadedUrls.keys())) {
        if (desiredKeys.has(key)) {
            continue;
        }

        const parsed = parseImageKey(key);

        if (!parsed) {
            continue;
        }

        releasePage(parsed.chapter, parsed.index);
    }
}