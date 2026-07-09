import * as React from "react";
import { App } from "obsidian";
import type MangaReaderPlugin from "../main";
import { CachedChapterIndex, ReaderAnchor } from "src/types";
import { createChapterIndexerOptions, isArchiveChapter } from "src/utils/ChapterIndexHelpers";
import { ImageCache } from "src/utils/ImageCache";
import { ImageLoader } from "src/utils/ImageLoader";
import { logger } from "src/utils/logger";

export interface UseSinglePageReaderOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    allChapters: string[];
    anchor: ReaderAnchor;
    onAnchorChange: (anchor: ReaderAnchor) => void;
}

export interface UseSinglePageReaderResult {
    chapterName: string;
    pageIndex: number;
    totalPages: number;
    url?: string;
    isLoading: boolean;
    error: string | null;
    goToPage: (pageIndex: number) => Promise<void>;
    goToChapter: (chapterName: string, pageIndex?: number) => Promise<void>;
}

interface ChapterImageLoaderEntry {
    loader: ImageLoader;
    cache: ImageCache;
}

export function useSinglePageReader({
    app,
    plugin,
    parentPath,
    allChapters,
    anchor,
    onAnchorChange,
}: UseSinglePageReaderOptions): UseSinglePageReaderResult {
    const [chapterIndex, setChapterIndex] = React.useState<CachedChapterIndex | null>(null);
    const [url, setUrl] = React.useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loaderMapRef = React.useRef<Map<string, ChapterImageLoaderEntry>>(new Map());
    const urlCacheRef = React.useRef<Map<string, string>>(new Map());

    const chapterName = anchor.chapterName;
    const pageIndex = anchor.pageIndex;

    const getLoader = React.useCallback((targetChapterName: string): ChapterImageLoaderEntry => {
        const existing = loaderMapRef.current.get(targetChapterName);

        if (existing) {
            return existing;
        }

        const cache = new ImageCache();

        const loader = new ImageLoader(
            parentPath,
            targetChapterName,
            cache,
            isArchiveChapter(targetChapterName),
            false,
            app
        );

        const entry = {
            loader,
            cache,
        };

        loaderMapRef.current.set(targetChapterName, entry);

        return entry;
    }, [
        app,
        parentPath,
    ]);

    React.useEffect(() => {
        let cancelled = false;

        const loadIndex = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const opts = createChapterIndexerOptions({
                    app,
                    parentPath,
                    chapterName,
                });

                const index = await plugin
                    .getChapterIndexManager()
                    .getOrBuildIndex(opts, 0);

                if (cancelled) return;

                setChapterIndex(index);
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

        loadIndex();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        chapterName,
    ]);

    React.useEffect(() => {
        let cancelled = false;

        const loadPageUrl = async () => {
            setUrl(undefined);

            if (!chapterIndex) {
                return;
            }

            if (pageIndex < 0 || pageIndex >= chapterIndex.pageCount) {
                return;
            }

            const key = `${chapterName}:${pageIndex}`;
            const cached = urlCacheRef.current.get(key);

            if (cached) {
                setUrl(cached);
                return;
            }

            setIsLoading(true);

            try {
                const { loader } = getLoader(chapterName);
                const nextUrl = await loader.load(pageIndex);

                if (cancelled) return;

                urlCacheRef.current.set(key, nextUrl);
                setUrl(nextUrl);
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

        loadPageUrl();

        return () => {
            cancelled = true;
        };
    }, [
        chapterIndex,
        chapterName,
        pageIndex,
        getLoader,
    ]);

    const goToChapter = React.useCallback(async (
        targetChapterName: string,
        targetPageIndex = 0
    ) => {
        onAnchorChange({
            chapterName: targetChapterName,
            pageIndex: Math.max(0, targetPageIndex),
        });
    }, [
        onAnchorChange,
    ]);

    const goToPage = React.useCallback(async (targetPageIndex: number) => {
        const totalPages = chapterIndex?.pageCount ?? 0;

        if (targetPageIndex >= totalPages) {
            const currentChapterIndex = allChapters.indexOf(chapterName);
            const nextChapter = allChapters[currentChapterIndex + 1];

            if (nextChapter) {
                onAnchorChange({
                    chapterName: nextChapter,
                    pageIndex: 0,
                });
            }

            return;
        }

        if (targetPageIndex < 0) {
            const currentChapterIndex = allChapters.indexOf(chapterName);
            const previousChapter = allChapters[currentChapterIndex - 1];

            if (!previousChapter) {
                return;
            }

            const opts = createChapterIndexerOptions({
                app,
                parentPath,
                chapterName: previousChapter,
            });

            const previousIndex = await plugin
                .getChapterIndexManager()
                .getOrBuildIndex(opts, 1);

            onAnchorChange({
                chapterName: previousChapter,
                pageIndex: Math.max(0, previousIndex.pageCount - 1),
            });

            return;
        }

        onAnchorChange({
            chapterName,
            pageIndex: targetPageIndex,
        });
    }, [
        allChapters,
        app,
        plugin,
        parentPath,
        chapterIndex,
        chapterName,
        onAnchorChange,
    ]);

    React.useEffect(() => {
        return () => {
            for (const entry of loaderMapRef.current.values()) {
                entry.cache.clear();
                entry.loader.clear();
            }

            loaderMapRef.current.clear();
            urlCacheRef.current.clear();
        };
    }, []);

    return {
        chapterName,
        pageIndex,
        totalPages: chapterIndex?.pageCount ?? 0,
        url,
        isLoading,
        error,
        goToPage,
        goToChapter,
    };
}