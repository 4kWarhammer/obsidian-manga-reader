import * as React from "react";
import { App } from "obsidian";
import { ReaderLayout, ReaderPageLayout } from "src/types";
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

    //Сколько Blob URL загружать параллельно.
    loadConcurrency?: number;
}

// Альтернатива ImageProvider, но с меньшим количеством методов
export interface VirtualImageLoaderResult {
    loadedUrls: Map<string, string>;
    isLoading: (chapter: string, index: number) => boolean;
    isInRange: (chapter: string, index: number) => boolean;
    releasePage: (chapter: string, index: number) => void;
    clear: () => void;
}

interface ChapterLoaderEntry {
    loader: ImageLoader;
    cache: ImageCache;
}

export function useVirtualImageLoader({
    app,
    parentPath,
    visiblePages,
    activePage,
    retainBefore = 6,
    retainAfter = 8,
    loadConcurrency = 2,
}: UseVirtualImageLoaderOptions): VirtualImageLoaderResult {
    const [loadedUrls, setLoadedUrls] = React.useState<Map<string, string>>(
        () => new Map()
    );

    const loadedUrlsRef = React.useRef<Map<string, string>>(new Map());
    const loadingSetRef = React.useRef<Set<string>>(new Set());
    const promiseMapRef = React.useRef<Map<string, Promise<string>>>(new Map());
    const chapterLoadersRef = React.useRef<Map<string, ChapterLoaderEntry>>(new Map());

    const desiredKeys = React.useMemo(() => {
        const keys = new Set<string>();

        for (const page of visiblePages) {
            keys.add(createImageKey(page.chapterName, page.index));
        }

        if (activePage) {
            for (const page of visiblePages) {
                if (page.chapterName !== activePage.chapterName) {
                    continue;
                }

                const min = activePage.index - retainBefore;
                const max = activePage.index + retainAfter;

                if (page.index >= min && page.index <= max) {
                    keys.add(createImageKey(page.chapterName, page.index));
                }
            }
        }

        return keys;
    }, [
        visiblePages,
        activePage,
        retainBefore,
        retainAfter,
    ]);

    const desiredKeysKey = React.useMemo(() => {
        return Array.from(desiredKeys).sort().join("\u0000");
    }, [desiredKeys]);

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
        loadedUrlsRef.current = new Map();

        setLoadedUrls(new Map());
    }, []);

    React.useEffect(() => {
        return () => {
            clear();
        };
    }, [clear]);

    React.useEffect(() => {
        const pagesToLoad = visiblePages.filter(page => {
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

        if (pagesToLoad.length === 0) {
            pruneLoadedUrlsToDesiredKeys(
                loadedUrlsRef.current,
                desiredKeys,
                releasePage
            );

            return;
        }

        let cancelled = false;

        void runWithConcurrency(
            pagesToLoad,
            loadConcurrency,
            async page => {
                const key = createImageKey(page.chapterName, page.index);

                if (cancelled) {
                    return {
                        key,
                        url: null,
                    };
                }

                loadingSetRef.current.add(key);

                const existingPromise = promiseMapRef.current.get(key);

                if (existingPromise) {
                    const url = await existingPromise;
                    return { key, url };
                }

                const { loader } = getChapterLoader(page.chapterName);

                const promise = loader.load(page.index);
                promiseMapRef.current.set(key, promise);

                const url = await promise;

                return {
                    key,
                    url,
                };
            },
            (_index, result) => {
                if (cancelled) {
                    return;
                }

                const { key, url } = result;

                loadingSetRef.current.delete(key);
                promiseMapRef.current.delete(key);

                if (!url) {
                    return;
                }

                if (!desiredKeys.has(key)) {
                    const parsed = parseImageKey(key);
                    if (parsed) {
                        releasePage(parsed.chapter, parsed.index);
                    }
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
            if (!cancelled) {
                logger.error("useVirtualImageLoader: failed to load visible images", error);
            }
        }).finally(() => {
            if (!cancelled) {
                pruneLoadedUrlsToDesiredKeys(
                    loadedUrlsRef.current,
                    desiredKeys,
                    releasePage
                );
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        visiblePages,
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