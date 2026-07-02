import * as React from "react";
import { App } from "obsidian";
// import JSZip from "jszip";
import MangaReaderPlugin from "../main";
import { translations } from "src/i18n";
import { MangaCanvas } from "./ui/MangaCanvas";
import { useProgressDebounce } from "src/hooks/useProgressDebounce";
import { useLazyImageLoader } from "src/hooks/useLazyImageLoader";
import { logger } from "src/utils/logger";
import { useElementSize } from "src/hooks/useElementSize";
import { useVirtualMangaReader } from "src/hooks/useVirtualMangaReader";

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавили плагин
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onChapterChange: (chapterName: string, resetPage?: boolean) => void
    onBack: () => void;
}

function useMinimumVisible(active: boolean, minMs: number): boolean {
    const [visible, setVisible] = React.useState(active);
    const startedAtRef = React.useRef<number | null>(active ? Date.now() : null);

    React.useEffect(() => {
        if (active) {
            if (startedAtRef.current === null) {
                startedAtRef.current = Date.now();
            }

            setVisible(true);
            return;
        }

        if (!visible) return;

        const startedAt = startedAtRef.current;
        const elapsed = startedAt ? Date.now() - startedAt : minMs;
        const remaining = Math.max(0, minMs - elapsed);

        const timer = window.setTimeout(() => {
            setVisible(false);
            startedAtRef.current = null;
        }, remaining);

        return () => {
            window.clearTimeout(timer);
        };
    }, [active, minMs, visible]);

    return active || visible;
}

// Блок инициализации изображений, загрузка
export const ReaderPage = ({ app, plugin, parentPath, chapterName, onChapterChange, onBack }: Props) => {

    const t = translations[plugin.data.settings.language || "en"]
    const isMobile = (app as any).isMobile;
    const isAutoScrolling = React.useRef(false);
    // вытаскиваем IntersectionObserver чтобы использовать не только в useEffect
    const observerRef = React.useRef<IntersectionObserver | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const viewportSize = useElementSize(containerRef);
    
    // Refs для отслеживания переключения глав в режиме скролла
    const lastChapterRef = React.useRef(chapterName);  // ← Последняя глава в Observer
    const transitionDebounceRef = React.useRef<NodeJS.Timeout | null>(null);  // ← Debounce для transitionToChapter
    const lastVisibleRef = React.useRef(0);
    const pendingTransitionKeyRef = React.useRef<string | null>(null);
    const pendingPositionKeyRef = React.useRef<string | null>(null);


    // Для requestAnimationFrame scroll
    const scrollRafRef = React.useRef<number | null>(null);
    const lastLoggedVirtualPageRef = React.useRef<string | null>(null);

    const [viewMode, setViewMode] = React.useState(plugin.data.settings.viewMode);
    // const [isLoading, setIsLoading] = React.useState(false);
    const [isPositioning, setIsPositioning] = React.useState(true);

    const toggleViewMode = async () => {
        const newMode = viewMode === "scroll" ? "single" : "scroll";

        // Надежнее перед сменой режима заблокировать и указать что сейчас будет смена режима
        // Так scroll DOM не успеет появиться на мгновение
        isAutoScrolling.current = true;
        setIsPositioning(true);

        // Обновляем визуальное состояние
        setViewMode(newMode);
        
        // Сохраняем в настройки плагина
        plugin.data.settings.viewMode = newMode;
        await plugin.saveSettings();
    };
    
    const savedData = plugin.data.library[parentPath];
    const savedPage = (savedData && savedData.lastChapter === chapterName)
        ? Math.max(0, (savedData.lastPage || 1) - 1)
        : 0;
    
    const initialPageKey = `${parentPath}::${chapterName}`;
    const initialPageRef = React.useRef({
        key: initialPageKey,
        page: savedPage,
    });

    if (initialPageRef.current.key !== initialPageKey) {
        initialPageRef.current = {
            key: initialPageKey,
            page: savedPage,
        };
    }

    const readerInitialPage = initialPageRef.current.page;

    // === ИНТЕГРАЦИЯ ХУКА ===
    const lazyLoader = useLazyImageLoader({
        parentPath,
        chapterName,
        bufferSize: 3,
        app,
        initialPage: readerInitialPage,
    });

    const {
        visibleIndex,           // ← Текущая видимая страница (единый источник правды)
        setVisible,             // ← Для IntersectionObserver
        loadedUrls,
        getTotalPages,
        getAllChapters,
        getChaptersToRender,
        transitionToChapter,
        getTotalPagesForChapter,
        getCurrentChapter,      // ← Для получения актуальной главы но с мемо
        currentChapter,
        isReady,
        isObserverReady,
    } = lazyLoader;

    // Пока временно подключаем virtual hook
    const virtualReader = useVirtualMangaReader({
        app,
        plugin,
        parentPath,
        chapterName,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        pageGap: 16,
        maxPageWidth: 1200,
        initialPage: readerInitialPage,
        overscan: 1000,
    });

    const allChapters = getAllChapters();
    const chaptersToRender = getChaptersToRender();
    const totalPages = getTotalPages();
    logger.ReaderPage(`Chapter has ${totalPages} pages`);

    const isReaderPreparing = virtualReader.isLoading || !isReady;
    const isReaderBusy = isReaderPreparing || isPositioning;
    const showReaderLoader = useMinimumVisible(isReaderBusy, 600);

    // Handler для виртуального скрола
    const handleVirtualScroll = React.useCallback(() => {
        const container = containerRef.current;

        if (!container) return;
        if (scrollRafRef.current !== null) return;

        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null;

            const scrollTop = container.scrollTop;
            const clientHeight = container.clientHeight;

            virtualReader.onScroll(scrollTop, clientHeight);
        });
    }, [virtualReader.onScroll]);

    // И сразу к нему CleanUp - пока временно
    React.useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current);
                scrollRafRef.current = null;
            }
        };
    }, []);

    // addEventListener для handleVirtualScroll
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener("scroll", handleVirtualScroll, { passive: true });

        return () => {
            container.removeEventListener("scroll", handleVirtualScroll);
        };
    }, [handleVirtualScroll]);

    // === ИСПРАВЛЕНИЕ: Мемоизируем callback, чтобы он не пересоздавался ===
    // Это гарантирует, что функция onSave остается одинаковой между рендерами
    const onSaveCallback = React.useCallback(
        async (pageIdx: number, chapterName: string) => {
            const path = parentPath;
            const progress = plugin.data.library[path];
            if (progress) {
                // Проверяем, что данные реально изменились
                if (progress.lastChapter === chapterName && progress.lastPage === pageIdx + 1) {
                    return;
                }
                progress.lastChapter = chapterName;
                progress.lastPage = pageIdx + 1;
                await plugin.saveProgress();
                logger.observer(`[Debounce] Saved: Chapter ${chapterName}, Page ${pageIdx + 1}`);
            }
        },
        // ЗАВИСИМОСТИ: пересчитываем callback только если изменится один из этих параметров
        [parentPath, plugin]  // parentPath и plugin стабильны (не меняются часто)
    );
    // === Теперь инициализируем hook со стабильным callback ===
    const { scheduleUpdate, flush } = useProgressDebounce(
        onSaveCallback,  // ← Функция одна и та же между рендерами!
        500 // Задержка 500мс, можно увеличить если хочешь более редкие сохранения
    );

    // Функция для перехода по страницам для single-page
    const goToPage = async (index: number, chapter: string) => {
        if (index >= totalPages) {
            // Если вышли за пределы — пытаемся включить следующую главу
            const nextIdx = allChapters.indexOf(chapter) + 1;
            if (nextIdx < allChapters.length) {
                const nextChapter = allChapters[nextIdx];
                // Переходим на следующую главу, сбрасываем на 1 страницу
                transitionToChapter(nextChapter, 0);
                scheduleUpdate(0, nextChapter);
                return;
            }
            return;
        }
        
        if (index < 0) {
            // Если листаем назад с первой страницы — на предыдущую главу
            const prevIdx = allChapters.indexOf(chapter) - 1;
            if (prevIdx >= 0) {
                const prevChapter = allChapters[prevIdx];
                // Получаем totalPages предыдущей главы для перехода на последнюю страницу
                const prevTotalPages = await getTotalPagesForChapter(prevChapter);
                const lastIndex = Math.max(0, prevTotalPages - 1);
                
                transitionToChapter(prevChapter, lastIndex);
                scheduleUpdate(lastIndex, prevChapter);
                return;
            }
            return;
        }

        // Обновляем видимую страницу через хук
        setVisible(index);
        scheduleUpdate(index, chapter);
    };

    // Эффект для добавления класса к телу при монтировании/размонтировании
    React.useEffect(() => {
        // При монтировании (открытии читалки)
        document.body.classList.add("is-manga-plugin-active");
        // Скрываем статус-бар для мобилок сразу
        if ((app as any).isMobile) {
            (app as any).emulateMobileFullscreen?.();
        }
        return () => {
            document.body.classList.remove("is-manga-plugin-active");
        };
    }, []);

    // Эффект для скролла наверх в постраничном режиме
    React.useEffect(() => {
        // Если мы в режиме "по страницам" и страница изменилась
        if (viewMode === "single" && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: "instant" });
        }
    }, [visibleIndex, viewMode]); // ← Используем visibleIndex вместо currentPage

    // Основной эффект загрузки
    React.useEffect(() => {
        flush();
    }, [parentPath, chapterName, flush]);
    // Тут надо проверить flush, возможно стоит убрать из зависимостей - лишние ререндеры ??

    // Отслеживание активной страницы для useVirtualMangaReader
    React.useEffect(() => {
        const activePage = virtualReader.activePage;

        if (!activePage) return;

        const key = `${activePage.chapterKey}:${activePage.index}`;

        if (lastLoggedVirtualPageRef.current === key) {
            return;
        }

        lastLoggedVirtualPageRef.current = key;

        logger.ReaderPage(
            `Virtual scroll active page: ${activePage.chapterName} #${activePage.index + 1}, range=${virtualReader.visibleRange.start}-${virtualReader.visibleRange.end}`
        );
    }, [
        virtualReader.activePage,
        virtualReader.visibleRange,
    ]);

    // Пока добавим, для сохранения корректной работы старой системы ниже
    // isReaderPreparing теперь может меняться в течении работы скролла читалки
    // Что вызывает лишние реакции со стороны Автоскроллf до нужной страницы
    React.useEffect(() => {
        const key = `${chapterName}:${viewMode}`;

        pendingPositionKeyRef.current = key;

        isAutoScrolling.current = true;
        setIsPositioning(true);

        logger.ReaderPage(`Positioning requested: ${key}`);
    }, [chapterName, viewMode]);

    // // Автоскролл до нужной страницы при загрузке или смене режима
    React.useEffect(() => {
        if (isReaderPreparing) return;

        const pendingKey = pendingPositionKeyRef.current;

        if (!pendingKey) return;

        const currentKey = `${chapterName}:${viewMode}`;

        if (pendingKey !== currentKey) return;

        logger.ReaderPage(`Positioning running: ${currentKey}`);

        const currentChapter = getCurrentChapter();
        const pageToScroll = viewMode === "scroll" ? visibleIndex : 0;
        const selector = `.manga-page-wrapper[data-chapter-name="${currentChapter}"][data-page-idx="${pageToScroll}"]`;

        let animationFrame: number | null = null;
        let unlockTimer: number | null = null;

        const scrollTimer = window.setTimeout(() => {
            const targetEl = containerRef.current?.querySelector(selector);

            if (targetEl) {
                targetEl.scrollIntoView({ behavior: "instant", block: "start" });
                logger.ReaderPage("Scrolled to:", currentChapter, pageToScroll);
            } else if (pageToScroll === 0 && containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: "instant" });
            }

            animationFrame = window.requestAnimationFrame(() => {
                setIsPositioning(false);
            });

            unlockTimer = window.setTimeout(() => {
                isAutoScrolling.current = false;
            }, 1000);

            pendingPositionKeyRef.current = null;
        }, 100);

        return () => {
            if (scrollTimer !== null) window.clearTimeout(scrollTimer);

            if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);

            if (unlockTimer !== null) window.clearTimeout(unlockTimer);
        };
    }, [
        isReaderPreparing,
        chapterName,
        viewMode,
    ]);

    React.useEffect(() => {
        lastVisibleRef.current = visibleIndex;
    }, [visibleIndex]);

    // Эффект: Обновлять lastChapterRef при смене главы извне (через onChapterChange)
    React.useEffect(() => {
        lastChapterRef.current = chapterName;
    }, [chapterName]);

    // Эффект для отслеживания скролла
    React.useEffect(() => {
        if (virtualReader.isLoading || !isObserverReady || totalPages === 0 || viewMode !== "scroll") return;

        // Debounce таймер для предотвращения слишком частых обновлений visibleIndex
        let visibleDebounceTimer: NodeJS.Timeout | null = null;
        const ratios = new Map<Element, number>();

        // Создаем "наблюдателя"
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (isAutoScrolling.current) return;

                // Обновляем snapshot ratio не только для текущего "тика".
                for (const entry of entries) {
                    ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
                }

                // Находим наиболее видимый элемент по полному snapshot.
                let mostVisible: { element: Element; ratio: number } | null = null;
                for (const [element, ratio] of ratios) {
                    if (ratio <= 0.3) continue;
                    if (!mostVisible || ratio > mostVisible.ratio) {
                        mostVisible = { element, ratio };
                    }
                }

                if (mostVisible) {
                    const target = mostVisible.element as HTMLElement;
                    const idx = parseInt(target.getAttribute('data-page-idx') || "0");
                    const chapterFromElement = target.getAttribute('data-chapter-name');

                    const currentCh = getCurrentChapter();
                    const candidateChapter = chapterFromElement || currentCh;
                    const isChapterChanged = Boolean(candidateChapter && candidateChapter !== currentCh);

                    if (isChapterChanged) {
                        const transitionKey = `${candidateChapter}:${idx}`;
                        if (pendingTransitionKeyRef.current !== transitionKey) {
                            pendingTransitionKeyRef.current = transitionKey;
                            if (transitionDebounceRef.current) {
                                clearTimeout(transitionDebounceRef.current);
                            }

                            transitionDebounceRef.current = setTimeout(() => {
                                if (isAutoScrolling.current) return;

                                const actualChapter = getCurrentChapter();
                                if (actualChapter === candidateChapter) return;
                                if (pendingTransitionKeyRef.current !== transitionKey) return;

                                logger.observer(`[Observer] Switching chapter: ${candidateChapter} at index ${idx}`);
                                transitionToChapter(candidateChapter, idx);
                                scheduleUpdate(idx, candidateChapter);
                                lastChapterRef.current = candidateChapter;
                                lastVisibleRef.current = idx;
                            }, 200);
                        }

                        return;
                    }

                    // Возврат в текущую главу: обязательно отменяем pending-transition.
                    pendingTransitionKeyRef.current = null;
                    if (transitionDebounceRef.current) {
                        clearTimeout(transitionDebounceRef.current);
                        transitionDebounceRef.current = null;
                    }

                    // Не дергаем setVisible если индекс не менялся.
                    if (idx === lastVisibleRef.current) return;

                    // === Debounce только для setVisible (короткий) ===
                    if (visibleDebounceTimer) {
                        clearTimeout(visibleDebounceTimer);
                    }

                    visibleDebounceTimer = setTimeout(() => {
                        if (isAutoScrolling.current) return;
                        if (getCurrentChapter() !== currentCh) return;
                        if (idx === lastVisibleRef.current) return;

                        lastVisibleRef.current = idx;
                        setVisible(idx);
                        scheduleUpdate(idx, currentCh);
                    }, 80);
                }
            },
            {
                root: containerRef.current,
                threshold: [0, 0.3, 0.5, 0.7, 1]
            }
        );

        // Находим обертки страниц
        const pageWrappers = containerRef.current?.querySelectorAll(".manga-page-wrapper");
        pageWrappers?.forEach(el => observerRef.current?.observe(el));

        return () => {
            // Очистка обоих таймеров
            if (visibleDebounceTimer) {
                clearTimeout(visibleDebounceTimer);
            }
            if (transitionDebounceRef.current) {
                clearTimeout(transitionDebounceRef.current);
                transitionDebounceRef.current = null;
            }
            pendingTransitionKeyRef.current = null;
            observerRef.current?.disconnect();
            observerRef.current = null;
        };
    }, [
        virtualReader.isLoading, 
        isObserverReady, 
        totalPages, 
        viewMode, 
        chapterName, 
        currentChapter, 
        scheduleUpdate
    ]);

    // заглушка при подгрузке страниц - уже не нужна, мешает MangaCanvas монтироваться
    // if (isLoading) return <div style={{ padding: "20px", color: "white" }}>{t.isloading}</div>;

    // Сам контейнер для отображения картинок

    const currentChapterIndex = allChapters.indexOf(currentChapter);
    const hasNext = currentChapterIndex < allChapters.length - 1;

    // Пока простая заглушка на случай ошибки
    if (virtualReader.error) {
        return (
            <div className="reader-error">
                <button onClick={onBack}>{t.back}</button>
                <p>Failed to index chapter metadata.</p>
                <pre>{virtualReader.error}</pre>
            </div>
        );
    }

    return (
        <div className={`manga-reader ${showReaderLoader ? "is-reader-loading" : ""}`}>
            <MangaCanvas
                containerRef={containerRef}
                isLoading={false}
                isMobile={isMobile}
                viewMode={viewMode}
                onToggleViewMode={toggleViewMode}
                currentPage={visibleIndex}
                chapterName={currentChapter}
                allChapters={allChapters}
                onBack={onBack}
                onChapterChange={onChapterChange}
                hasNextChapter={hasNext}
                onPageClick={(idx, ch) => goToPage(idx, ch)}
                imageProvider={lazyLoader}
                chaptersToRender={chaptersToRender}
            />

            {showReaderLoader && (
                <div className="manga-reader-global-loader">
                    <div className="spinner"></div>
                    <div className="manga-reader-global-loader-text">
                        {virtualReader.indexingProgress
                            ? `Indexing ${virtualReader.indexingProgress.loaded}/${virtualReader.indexingProgress.total}`
                            : t.isloading}
                    </div>
                </div>
            )}
        </div>
    );
};
