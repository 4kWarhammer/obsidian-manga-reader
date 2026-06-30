import { useState, useEffect, useRef, useCallback } from 'react';
import { App } from 'obsidian';
import { ChapterCacheManager } from 'src/utils/ChapterCacheManager';
import { logger } from 'src/utils/logger';


interface Props {
    parentPath: string;
    chapterName: string;
    bufferSize: number;
    app: App;
    initialPage?: number;
}

interface RetainedRange {
    chapter: string;
    start: number;
    end: number;
}

const EDGE_PRELOAD_COUNT = 2;
const BATCHING_INTERVAL = 32;


export const useLazyImageLoader = ({
    parentPath,
    chapterName,
    bufferSize = 2,
    app,
    initialPage = 0
}: Props) => {
    // === ИНИЦИАЛИЗАЦИЯ (один раз при монтировании) ===
    const managerRef = useRef(new ChapterCacheManager);
    const [currentChapter, setCurrentChapter] = useState(chapterName);
    const currentChapterRef = useRef(chapterName);  // ← Актуальное значение для эффектов
    const [visibleIndex, setVisibleIndex] = useState(initialPage);
    // это глобальный флаг, используется для показа заглушки на читалку
    const [isReady, setIsReady] = useState(false);
    // Частный флаг для обсервера в ReaderPage, чтобы последний не мог стартануть раньше
    // чем закончится настройка главы и будут выситаны totalPage для соседей
    const [isObserverReady, setIsObserverReady] = useState(false);

    const loadingSetRef = useRef<Set<string>>(new Set());
    const [realTotalPages, setRealTotalPages] = useState(0);

    // Реактивный кэш URL для getImageUrl (для мгновенного доступа при повторных запросах)
    // Синхронизирован с ImageCache
    const [loadedUrls, setLoadedUrls] = useState<Map<string, string>>(new Map());
    const loadedUrlsRef = useRef<Map<string, string>>(new Map());

    // Делаем батчинг в loadedUrls
    const pendingLoadedUrlsRef = useRef<Map<string, string>>(new Map());
    const flushTimerRef = useRef<number | null>(null);

    // Кэш Promise'ов: ключ "chapterName:pageIndex" -> Promise<string>
    // нужен для отслеживания состояния загрузки каждого изображения
    const promiseMapRef = useRef(new Map<string, Promise<string>>());
    const retainedRangeRef = useRef<RetainedRange | null>(null);

    // Функция для удаления из loadedUrls и loadedUrlsRef
    const deleteLoadedUrl = useCallback((key: string) => {
        pendingLoadedUrlsRef.current.delete(key);

        setLoadedUrls(prev => {
            if (!prev.has(key)) return prev;

            const next = new Map(prev);
            next.delete(key);
            loadedUrlsRef.current = next;

            return next;
        });
    }, []);

    // === ФУНКЦИИ ===
    /**
     * Проверяет, загружается ли страница в данный момент
     * 
     * Но сейчас эта функция не используется
     * 
     * Не вижу использования данной функции где то дальше
     * @returns boolean
     */
    const isLoading = useCallback((chapter: string, index: number): boolean => {
        const key = `${chapter}:${index}`;
        return loadingSetRef.current.has(key);
    }, []);

    // Выгрузить страницу из всех кэшей (память + React state)
    const releasePage = useCallback((chapter: string, index: number): void => {
        const key = `${chapter}:${index}`;

        const hasLoadedUrl = loadedUrlsRef.current.has(key);
        const hasPromise = promiseMapRef.current.has(key);
        const isLoading = loadingSetRef.current.has(key);
        const hasPendingUrl = pendingLoadedUrlsRef.current.has(key);

        // Быстрый выход
        if (!hasLoadedUrl && !hasPromise && !isLoading && !hasPendingUrl) {
            return;
        }

        // 1. Сначала пробуем выгружать из loadedUrls - у него приоритет
        // по сравнению с ImageCache, потому что на нем завязано DOM дерево
        if (hasLoadedUrl) {
            deleteLoadedUrl(key);
        }

        // 2.Пеперь чистим все временные Ref
        promiseMapRef.current.delete(key);
        loadingSetRef.current.delete(key);
        pendingLoadedUrlsRef.current.delete(key);

        // 3. И только теперь выгружаем из Cache
        managerRef.current.release(chapter, index);

        logger.lazyLoader(`useLazyImageLoader: Released page ${key}`);

    }, [deleteLoadedUrl]);  // ← managerRef, promiseMapRef — стабильные ref, не нужны в зависимостях

    const isInRange = useCallback((chapter: string, index: number): boolean => {
        if (chapter !== currentChapterRef.current) return false;

        const start = Math.max(0, visibleIndex - bufferSize);
        const end = Math.min(realTotalPages - 1, visibleIndex + bufferSize);

        return index >= start && index <= end;
    }, [visibleIndex, bufferSize, realTotalPages]);

    // Тут интересная логика применена.
    // Если наш центр будет находится близко к границам главы, 
    // то логика будет пытаться сохранить retained range
    const getRetainedRange = useCallback((
        center: number,
        totalPages: number,
        retainHalfSize: number
    ): { start: number; end: number } => {
        const windowSize = retainHalfSize * 2 + 1;

        let start = center - retainHalfSize;
        let end = center + retainHalfSize;

        if (start < 0) {
            start = 0;
            end = Math.min(totalPages - 1, windowSize - 1);
        }

        if (end > totalPages - 1) {
            end = totalPages - 1;
            start = Math.max(0, end - windowSize + 1);
        }

        return { start, end };
    }, []);

    const isLoadRangeInsideRetainedRange = useCallback((
        retainedRange: RetainedRange | null,
        chapter: string,
        loadStart: number,
        loadEnd: number
    ): boolean => {
        return !!retainedRange &&
            retainedRange.chapter === chapter &&
            loadStart >= retainedRange.start &&
            loadEnd <= retainedRange.end;
    }, []);

    // loadedUrlsRef хранит key как: `${chapter}:${index}`
    // Нужно иногда распарсивать
    const parseImageKey = useCallback((key: string): { chapter: string; index: number } | null => {
        // Используем lastIndexOf, потому что в названии главы может встретиться ":" 
        // и тогда все поломается, а мы берем последний ":"
        const separatorIndex = key.lastIndexOf(":");

        if (separatorIndex === -1) {
            return null;
        }

        const chapter = key.slice(0, separatorIndex);
        const index = Number(key.slice(separatorIndex + 1));

        if (!chapter || Number.isNaN(index)) {
            return null;
        }

        return { chapter, index };
    }, []);

    // Этот хук будет отвечать на вопрос что должно быть в loadedUrls
    // Это наша политика удержания изображений
    const getChaptersToKeep = useCallback((chapter: string): string[] => {
        const adjacent = managerRef.current.getAdjacentChapters(chapter);

        return [
            adjacent.prev,
            chapter,
            adjacent.next,
        ].filter((value): value is string => Boolean(value));
    }, []);

    const pruneManagerToPolicy = useCallback((chapter: string): void => {
        const keepChapters = getChaptersToKeep(chapter);
        managerRef.current.pruneOldChapters(keepChapters);
    }, [getChaptersToKeep]);

    const shouldKeepPage = useCallback((
        chapter: string,
        index: number,
        retainedRange: RetainedRange | null = retainedRangeRef.current
    ): boolean => {
        const activeChapter = currentChapterRef.current;
        const adjacent = managerRef.current.getAdjacentChapters(activeChapter);

        // 1. Current chapter: держим retained range
        if (
            retainedRange &&
            chapter === retainedRange.chapter &&
            index >= retainedRange.start &&
            index <= retainedRange.end
        ) {
            return true;
        }

        // 2. Previous chapter: держим последние EDGE_PRELOAD_COUNT страниц
        if (adjacent.prev && chapter === adjacent.prev) {
            const total = managerRef.current.getTotalPagesSync(chapter);

            if (total <= 0) {
                return false;
            }

            const start = Math.max(0, total - EDGE_PRELOAD_COUNT);
            return index >= start && index < total;
        }

        // 3. Next chapter: держим первые EDGE_PRELOAD_COUNT страниц
        if (adjacent.next && chapter === adjacent.next) {
            return index >= 0 && index < EDGE_PRELOAD_COUNT;
        }

        // 4. Всё остальное выгружаем
        return false;
    }, []);

    // Функция удаления изображений из loadedUrls согласно политики удержания
    const pruneLoadedUrlsToPolicy = useCallback((retainedRange: RetainedRange | null): void => {
        // 1. Сначала чистим уже отображаемые / render-approved URL
        for (const key of Array.from(loadedUrlsRef.current.keys())) {
            const parsed = parseImageKey(key);

            if (!parsed) {
                deleteLoadedUrl(key);
                continue;
            }

            if (!shouldKeepPage(parsed.chapter, parsed.index, retainedRange)) {
                releasePage(parsed.chapter, parsed.index);
            }
        }

        // 2. Потом чистим pending batch, чтобы stale URL не добавились позже
        for (const key of Array.from(pendingLoadedUrlsRef.current.keys())) {
            const parsed = parseImageKey(key);

            if (!parsed) {
                pendingLoadedUrlsRef.current.delete(key);
                continue;
            }

            if (!shouldKeepPage(parsed.chapter, parsed.index, retainedRange)) {
                releasePage(parsed.chapter, parsed.index);
            }
        }
    }, [parseImageKey, shouldKeepPage, releasePage, deleteLoadedUrl]);

    // Делаем батчинг для loadedUrls, чтобы уменьшить количество ререндеров
    const flushLoadedUrls = useCallback(() => {
        flushTimerRef.current = null;

        const pending = pendingLoadedUrlsRef.current;
        if (pending.size === 0) return;

        pendingLoadedUrlsRef.current = new Map();

        setLoadedUrls(prev => {
            let changed = false;
            const next = new Map(prev);

            for (const [key, url] of pending) {
                const parsed = parseImageKey(key);

                if (!parsed) continue;

                if (!shouldKeepPage(parsed.chapter, parsed.index, retainedRangeRef.current)) {
                    managerRef.current.release(parsed.chapter, parsed.index);
                    continue;
                }

                if (next.get(key) !== url) {
                    next.set(key, url);
                    changed = true;
                }
            }

            if (!changed) return prev;

            // Не забываем также обновить и Ref
            loadedUrlsRef.current = next;
            return next;
        });
    }, [shouldKeepPage]);

    // Очередь
    const queueLoadedUrl = useCallback((key: string, url: string) => {
        pendingLoadedUrlsRef.current.set(key, url);

        if (flushTimerRef.current === null) {
            flushTimerRef.current = window.setTimeout(flushLoadedUrls, BATCHING_INTERVAL);
        }
    }, [flushLoadedUrls]);


    const getImageUrl = useCallback(async (chapter: string, index: number): Promise<string> => {
        const key = `${chapter}:${index}`;

        // 1. Проверяем реактивный state (для мгновенного доступа)
        const fromState = loadedUrlsRef.current.get(key);
        if (fromState) {
            return fromState;
        }

        // 2. Проверяем ImageCache (персистентный кэш)
        const cached = managerRef.current.getUrl(chapter, index);
        if (cached) {
            if (!shouldKeepPage(chapter, index, retainedRangeRef.current)) {
                managerRef.current.release(chapter, index);
                return "";
            }

            queueLoadedUrl(key, cached);
            return cached;
        }

        // 3. Проверяем promiseMapRef (идёт ли загрузка)
        const existingPromise = promiseMapRef.current.get(key);
        if (existingPromise) {
            const result = await existingPromise;

            if (!shouldKeepPage(chapter, index, retainedRangeRef.current)) {
                managerRef.current.release(chapter, index);
                return "";
            }

            queueLoadedUrl(key, result);
            return result;
        }

        // 4. Создаём новый Promise загрузки
        const promise = managerRef.current.loadPage(chapter, index);
        promiseMapRef.current.set(key, promise);

        // 5. Обновляем состояние загрузки
        loadingSetRef.current.add(key);

        // 6. Ждём результата
        try {
            const result = await promise;
            
            // проверяем на соответствие политики удержания
            if (!shouldKeepPage(chapter, index, retainedRangeRef.current)) {
                managerRef.current.release(chapter, index);
                return "";
            }

            // 7. Обновляем реактивный state → триггерит ре-рендер
            queueLoadedUrl(key, result);
            return result;
        } finally {
            // 8. Очищаем временные данные
            promiseMapRef.current.delete(key);
            loadingSetRef.current.delete(key);
        }
    }, [queueLoadedUrl, shouldKeepPage]);

    // === CALLBACK: Обновление loadedUrls при предзагрузке ===
    // Мемоизируем, чтобы не пересоздавался при каждом рендере
    const handleImageLoaded = useCallback((chapter: string, index: number, url: string) => {
        const key = `${chapter}:${index}`;

        if (shouldKeepPage(chapter, index, retainedRangeRef.current)) {
            queueLoadedUrl(key, url);
        } else {
            managerRef.current.release(chapter, index);
        }

        logger.lazyLoader(`[Preload] Callback: Loaded ${key}`);
    }, [queueLoadedUrl, shouldKeepPage]);

    // Просто устанавливаем индекс текущий
    const setVisible = useCallback((index: number): void => {
        setVisibleIndex(index);
    }, []);

    const transitionToChapter = (newChapter: string, startIndex: number = 0) => {
        const startedAt = performance.now();
        // 1. Сначала обновляем ref, потому что shouldKeepPage использует currentChapterRef
        currentChapterRef.current = newChapter;

        // 2. Если totalPages уже известен, сразу обновляем retained range
        const newTotal = managerRef.current.getTotalPagesSync(newChapter);

        if (newTotal > 0) {
            const retainHalfSize = bufferSize * 2;
            const nextRange = getRetainedRange(startIndex, newTotal, retainHalfSize);

            const nextRetainedRange: RetainedRange = {
                chapter: newChapter,
                start: nextRange.start,
                end: nextRange.end,
            };

            retainedRangeRef.current = nextRetainedRange;

            // Важно: чистим по новой политике ДО запуска preload соседей
            pruneLoadedUrlsToPolicy(nextRetainedRange);
            pruneManagerToPolicy(newChapter);

            setRealTotalPages(newTotal);

            logger.lazyLoader(`useLazyImageLoader: Updated totalPages to ${newTotal} for "${newChapter}"`);
            logger.observer(`[BUFFER] retained range pre-set to [${nextRange.start}-${nextRange.end}] for "${newChapter}"`);
        } else {
            // Если total ещё неизвестен, retained range пока нельзя вычислить
            retainedRangeRef.current = null;
        }

        // 3. Обновляем React state
        setCurrentChapter(newChapter);
        setVisibleIndex(startIndex);

        logger.lazyLoader(`useLazyImageLoader: Soft transition to chapter "${newChapter}" at index ${startIndex}`);
        logger.perf(`transitionToChapter sync took ${performance.now() - startedAt}ms`);
    };

    // === EFFECT 1: Инициализация (срабатывает 1 раз при монтировании) ===
    useEffect(() => {
        // 0. Инициализируем менеджер
        managerRef.current.initialize(parentPath, app);

        // 1. Загружаем список глав
        managerRef.current.loadChaptersList();

        // 3. Инициализируем currentChapter state и ref
        currentChapterRef.current = chapterName;
        setCurrentChapter(chapterName);
        setVisibleIndex(initialPage);

        logger.lazyLoader("useLazyImageLoader: Initialized chapter", chapterName);
    }, [parentPath, app]);

    // === EFFECT 2: Настройка главы (срабатывает при смене currentChapter) ===
    useEffect(() => {
        if (!currentChapter) return;
        const startedAt = performance.now();

        let canceled = false;

        setIsObserverReady(false);

        const knownTotal = managerRef.current.getTotalPagesSync(currentChapter);
        if (knownTotal > 0) {
            setRealTotalPages(knownTotal);
            setIsReady(true);
        } else {
            setRealTotalPages(0);
            setIsReady(false);
        }

        const setupChapter = async () => {
            logger.lazyLoader(`useLazyImageLoader: Setting up chapter "${currentChapter}"`);

            // 1. Создаем loader для текущей главы
            managerRef.current.getLoader(currentChapter);

            // 2. Создаем loaders для соседних глав (предзагрузка!)
            const adjacent = managerRef.current.getAdjacentChapters(currentChapter);
            if (adjacent.prev) managerRef.current.getLoader(adjacent.prev);
            if (adjacent.next) managerRef.current.getLoader(adjacent.next);

            // 3. Fetch totalPages для текущей и соседних глав
            try {
                const currentTotalPromise = managerRef.current.getTotalPages(currentChapter);

                const prevTotalPromise = adjacent.prev
                    ? managerRef.current.getTotalPages(adjacent.prev)
                    : Promise.resolve(null);

                const nextTotalPromise = adjacent.next
                    ? managerRef.current.getTotalPages(adjacent.next)
                    : Promise.resolve(null);

                const [total] = await Promise.all([
                    currentTotalPromise,
                    prevTotalPromise,
                    nextTotalPromise,
                ]);

                if (canceled) return;

                setRealTotalPages(total);

                managerRef.current.setCurrentChapter(currentChapter, handleImageLoaded);

                setIsObserverReady(true);
                // setIsReady(true);

                logger.lazyLoader(`useLazyImageLoader: Total pages for "${currentChapter}": ${total}`);
                logger.perf(`setupChapter totals took ${performance.now() - startedAt}ms for ${currentChapter}`);
            } catch (err) {
                if (!canceled) {
                    logger.error("useLazyImageLoader: Failed to fetch totalPages,", err);
                }
            } finally {
                if (!canceled) {
                    setIsReady(true);
                }
            }
        };

        setupChapter();

        return () => {
            canceled = true;
        };
    }, [currentChapter, handleImageLoaded]);


    // === EFFECT 3: Буфер загрузки. Загружать когда видимая страница меняется ===
    useEffect(() => {
        // Не загружаем, пока не знаем количество страниц
        if (realTotalPages === 0) return;

        // Используем актуальное значение из ref, а не из closure
        const activeChapter = currentChapterRef.current;

        // Диапазон для загрузки
        const loadStart = Math.max(0, visibleIndex - bufferSize);
        const loadEnd = Math.min(realTotalPages - 1, visibleIndex + bufferSize);

        // Диапазон для retained range, он больше диапазона загрузки
        const retainHalfSize = bufferSize * 2;
        const previousRetainedRange = retainedRangeRef.current;

        // Тут проверка на попадание в диапазон
        const loadRangeFits = isLoadRangeInsideRetainedRange(
            previousRetainedRange,
            activeChapter,
            loadStart,
            loadEnd
        
        );

        // Если в диапазон не попали, то:
        if (!loadRangeFits) {
            // 1. Определяем новый диапазон, исходя из текущей страницы
            const nextRange = getRetainedRange(
                visibleIndex,
                realTotalPages,
                retainHalfSize
            );

            // 2. Обновляем retained range
            const toUpdateRetainedRange: RetainedRange = {
                chapter: activeChapter,
                start: nextRange.start,
                end: nextRange.end,
            };

            retainedRangeRef.current = toUpdateRetainedRange;

            // 3. Чистим loadedUrls согласно политике удержания
            pruneLoadedUrlsToPolicy(toUpdateRetainedRange);

            // 4. Чистим менеджер от глав вне prev/current/next
            pruneManagerToPolicy(activeChapter);

            logger.lazyLoader(`[BUFFER] retained range changed to [${nextRange.start}-${nextRange.end}] for "${activeChapter}"`);
        } else {
            logger.lazyLoader(`[BUFFER] retained range unchanged [${previousRetainedRange!.start}-${previousRetainedRange!.end}], load range [${loadStart}-${loadEnd}]`);
        }

        // Загружаем страницы только в коротком диапазоне - bufferSize
        const promises = [];
        for (let i = loadStart; i <= loadEnd; i++) {
            promises.push(getImageUrl(activeChapter, i));
        }

        // Запускаем загрузку всех страниц параллельно
        Promise.all(promises).catch(err => logger.error("Image loading error:", err));

    }, [
        visibleIndex, 
        bufferSize, 
        realTotalPages, 
        currentChapter, 
        getImageUrl, 
        getRetainedRange,
        isLoadRangeInsideRetainedRange,
        pruneLoadedUrlsToPolicy,
        pruneManagerToPolicy
    ]);
    
    // === CLEANUP ===
    useEffect(() => {
        return () => { 
            if (flushTimerRef.current !== null) {
                window.clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }

            pendingLoadedUrlsRef.current.clear();

            managerRef.current.clear(); // Выгружаем все Blob Url's
            promiseMapRef.current.clear(); // Чистим кэш с Promise's
         };
    }, []);

    const getAllChapters = (): string[] => {
        return managerRef.current.getAllChapters();
    };

    // Получить главы для рендера (текущая + соседи)
    const getChaptersToRender = (): { chapterName: string; totalPages: number }[] => {
        const chapters = managerRef.current.getAllChapters();
        const currentIdx = chapters.indexOf(currentChapter);
        
        if (currentIdx === -1 || chapters.length === 0) {
            // Fallback: только текущая глава
            return [{ chapterName: currentChapter, totalPages: realTotalPages }];
        }
        
        const result: { chapterName: string; totalPages: number }[] = [];
        
        // Предыдущая глава
        if (currentIdx > 0) {
            const prevChapter = chapters[currentIdx - 1];
            result.push({
                chapterName: prevChapter,
                totalPages: getTotalPagesSync(prevChapter)
            });
        }
        
        // Текущая глава
        result.push({ chapterName: currentChapter, totalPages: realTotalPages });
        
        // Следующая глава
        if (currentIdx < chapters.length - 1) {
            const nextChapter = chapters[currentIdx + 1];
            result.push({
                chapterName: nextChapter,
                totalPages: getTotalPagesSync(nextChapter)
            });
        }
        
        return result;
    };

    // Вспомогательная функция для синхронного получения totalPages
    const getTotalPagesSync = (chapterName: string): number => {
        return managerRef.current.getTotalPagesSync(chapterName);
    };

    // Получить totalPages для главы (async, для первичной загрузки)
    const getTotalPagesForChapter = async (chapter: string): Promise<number> => {
        return managerRef.current.getTotalPages(chapter);
    };

    const getCurrentChapter = useCallback((): string => {
        return currentChapterRef.current;
    }, []);


    return {
        getImageUrl,
        loadedUrls,
        releasePage,
        isInRange,
        isLoading,
        setVisible,
        visibleIndex,  // ← Добавили для внешнего использования
        getAllChapters,
        getTotalPages: () => realTotalPages,
        getTotalPagesForChapter,
        transitionToChapter,
        getCurrentChapter,
        currentChapter,
        getChaptersToRender,
        isReady,
        isObserverReady,
    };
};
