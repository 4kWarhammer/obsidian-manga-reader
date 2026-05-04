import { useState, useEffect, useRef, useCallback } from 'react';
import { App } from 'obsidian';
import { ChapterCacheManager } from 'src/utils/ChapterCacheManager';


interface Props {
    parentPath: string;
    chapterName: string;
    // totalPages: number;
    bufferSize: number;
    app: App;
    // isArchive: boolean;
    isExternal: boolean;
    initialPage?: number;
}

export const useLazyImageLoader = ({
    parentPath,
    chapterName,
    // totalPages,
    bufferSize = 2,
    app,
    // isArchive,
    isExternal,
    initialPage = 0
}: Props) => {
    // === ИНИЦИАЛИЗАЦИЯ (один раз при монтировании) ===
    const managerRef = useRef(new ChapterCacheManager);
    const [currentChapter, setCurrentChapter] = useState(chapterName);
    const currentChapterRef = useRef('');  // ← Актуальное значение для эффектов
    const [visibleIndex, setVisibleIndex] = useState(initialPage);

    // Ключ загрузки: "chapterName:pageIndex" - пока не понял
    const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
    const [realTotalPages, setRealTotalPages] = useState(0);

    // Реактивный кэш URL для getImageUrl (для мгновенного доступа при повторных запросах)
    // Синхронизирован с ImageCache
    const [loadedUrls, setLoadedUrls] = useState<Map<string, string>>(new Map());

    // Кэш Promise'ов: ключ "chapterName:pageIndex" -> Promise<string>
    const promiseMapRef = useRef(new Map<string, Promise<string>>());

    // === CALLBACK: Обновление loadedUrls при предзагрузке ===
    // Мемоизируем, чтобы не пересоздавался при каждом рендере
    const handleImageLoaded = useCallback((chapter: string, index: number, url: string) => {
        const key = `${chapter}:${index}`;
        setLoadedUrls(prev => new Map(prev).set(key, url));
        console.log(`[Preload] Callback: Loaded ${key}`);
    }, []);  // ← Пустые зависимости, т.к. используем функциональное обновление state

    // === EFFECT 1: Инициализация (срабатывает 1 раз при монтировании) ===
    useEffect(() => {
        // 0. Инициализируем менеджер
        managerRef.current.initialize(parentPath, isExternal, app);

        // 1. Загружаем список глав
        managerRef.current.loadChaptersList(parentPath, isExternal, app);

        // 2. Устанавливаем текущую главу с callback для предзагрузки соседних глав
        managerRef.current.setCurrentChapter(chapterName, handleImageLoaded);

        // 3. Инициализируем currentChapter state и ref
        setCurrentChapter(chapterName);
        currentChapterRef.current = chapterName;

        console.log("useLazyImageLoader: Initialized chapter", chapterName);
    }, [parentPath, chapterName, isExternal, app, handleImageLoaded]);

    // === EFFECT 2: Настройка главы (срабатывает при смене currentChapter) ===
    useEffect(() => {
        if (!currentChapter) return;

        const setupChapter = async () => {
            console.log(`useLazyImageLoader: Setting up chapter "${currentChapter}"`);

            // 1. Создаем loader для текущей главы
            managerRef.current.getLoader(currentChapter);

            // 2. Создаем loaders для соседних глав (предзагрузка!)
            const adjacent = managerRef.current.getAdjacentChapters(currentChapter);
            if (adjacent.prev) managerRef.current.getLoader(adjacent.prev);
            if (adjacent.next) managerRef.current.getLoader(adjacent.next);

            // 3. Fetch totalPages для текущей и соседних глав
            try {
                const total = await managerRef.current.getTotalPages(currentChapter);
                setRealTotalPages(total);
                console.log(`useLazyImageLoader: Total pages for "${currentChapter}": ${total}`);

                if (adjacent.prev) {
                    await managerRef.current.getTotalPages(adjacent.prev);
                    console.log(`useLazyImageLoader: Cached totalPages for "${adjacent.prev}"`);
                }
                if (adjacent.next) {
                    await managerRef.current.getTotalPages(adjacent.next);
                    console.log(`useLazyImageLoader: Cached totalPages for "${adjacent.next}"`);
                }
            } catch (err) {
                console.error("useLazyImageLoader: Failed to fetch totalPages,", err);
            }
        };

        setupChapter();
    }, [currentChapter]);

    // === ФУНКЦИИ ===
    const getImageUrl = useCallback(async (chapter: string, index: number): Promise<string> => {
        const key = `${chapter}:${index}`;

        // 1. Проверяем реактивный state (для мгновенного доступа)
        const fromState = loadedUrls.get(key);
        if (fromState) {
            return fromState;
        }

        // 2. Проверяем ImageCache (персистентный кэш)
        const cached = managerRef.current.getUrl(chapter, index);
        if (cached) {
            // Синхронизируем state с ImageCache
            setLoadedUrls(prev => new Map(prev).set(key, cached));
            return cached;
        }

        // 3. Проверяем promiseMapRef (идёт ли загрузка)
        if (promiseMapRef.current.has(key)) {
            return promiseMapRef.current.get(key)!;
        }

        // 4. Создаём новый Promise загрузки
        const promise = managerRef.current.loadPage(chapter, index);
        promiseMapRef.current.set(key, promise);

        // 5. Обновляем состояние загрузки
        setLoadingSet(prev => new Set([...prev, key]));

        // 6. Ждём результата
        try {
            const result = await promise;

            // 7. Обновляем реактивный state → триггерит ре-рендер
            setLoadedUrls(prev => new Map(prev).set(key, result));

            return result;
        } finally {
            // 8. Очищаем временные данные
            promiseMapRef.current.delete(key);
            setLoadingSet(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [loadedUrls]);  // ← loadedUrls — единственная зависимость, которая влияет на логику

    /**
     * Проверяет, загружается ли страница в данный момент
     * 
     * Это единственное место, где используется loadingSet, 
     * который обновляется при начале и завершении загрузки страницы.
     * 
     * Не вижу использования данной функции где то дальше
     * @returns boolean
     */
    const isLoading = (chapter: string, index: number): boolean => {
        const key = `${chapter}:${index}`;
        return loadingSet.has(key);
    };

    // Выгрузить страницу из всех кэшей (память + React state)
    const releasePage = useCallback((chapter: string, index: number): void => {
        const key = `${chapter}:${index}`;

        // 1. Выгружаем из ImageCache (освобождаем blob URL)
        managerRef.current.release(chapter, index);

        // 2. Удаляем из реактивного state (триггерит ре-рендер)
        setLoadedUrls(prev => {
            const next = new Map(prev);
            next.delete(key);
            return next;
        });

        // 3. Удаляем из promiseMapRef
        promiseMapRef.current.delete(key);

        // 4. Удаляем из loadingSet
        setLoadingSet(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });

        // console.log(`useLazyImageLoader: Released page ${key}`);
    }, []);  // ← managerRef, promiseMapRef — стабильные ref, не нужны в зависимостях

    const isInRange = (index: number): boolean => {
        const start = Math.max(0, visibleIndex - bufferSize);
        const end = Math.min(realTotalPages - 1, visibleIndex + bufferSize);

        return index >= start && index <= end;
    }

    const setVisible = useCallback((index: number): void => {
        setVisibleIndex(index);
    }, []);

    const transitionToChapter = (newChapter: string, startIndex: number = 0) => {
        // 1. Уведомляем менеджер о смене главы (с callback для предзагрузки)
        managerRef.current.setCurrentChapter(newChapter, handleImageLoaded);

        // 2. Обновляем state → это триггерит EFFECT 2
        setCurrentChapter(newChapter);
        
        // 3. Обновляем ref → для эффекта буфера
        currentChapterRef.current = newChapter;

        // 4. Обновляем totalPages из кэша (мгновенно, для буфера)
        const newTotal = managerRef.current.getTotalPagesSync(newChapter);
        if (newTotal > 0) {
            setRealTotalPages(newTotal);
            console.log(`useLazyImageLoader: Updated totalPages to ${newTotal} for "${newChapter}"`);
        }

        // 5. Сбрасываем страницу
        setVisibleIndex(startIndex);

        console.log(`useLazyImageLoader: Soft transition to chapter "${newChapter}" at index ${startIndex}`);
    };

    // === EFFECT 3: Буфер загрузки. Загружать когда видимая страница меняется ===
    useEffect(() => {
        // Не загружаем, пока не знаем количество страниц
        if (realTotalPages === 0) return;

        // Используем актуальное значение из ref, а не из closure
        const activeChapter = currentChapterRef.current;

        // Диапазон для загрузки
        const start = Math.max(0, visibleIndex - bufferSize);
        const end = Math.min(realTotalPages - 1, visibleIndex + bufferSize);

        console.log(`[BUFFER] visibleIndex changed to ${visibleIndex}, loading range [${start}-${end}]`);
        console.log(`[BUFFER] Releasing pages 0-${start-1} and ${end+1}-${realTotalPages-1}`);

        // Загружаем страницы в этом диапазоне
        const promises = [];
        for (let i = start; i <= end; i++) {
            promises.push(getImageUrl(activeChapter, i));
        }

        // Запускаем загрузку всех страниц параллельно
        Promise.all(promises).catch(err => console.error("Image loading error:", err));

        // Выгружаем страницы которые не входят в текущий актуальный диапазон
        for (let i = 0; i < start; i++) {
            releasePage(activeChapter, i);
        }

        for (let i = end + 1; i < realTotalPages; i++) {
            releasePage(activeChapter, i);
        }
    }, [visibleIndex, bufferSize, realTotalPages]);  // ← Добавили getImageUrl и releasePage
    
    // === CLEANUP ===
    useEffect(() => {
        return () => { 
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
        getChaptersToRender,
    };
};
