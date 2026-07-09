import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { useReaderInitialPage } from "src/hooks/useReaderInitialPage";
import { useMinimumVisible } from "src/hooks/useMinimumVisible";
import { translations } from "src/i18n";
import { MangaCanvas } from "./ui/MangaCanvas";
import { useLazyImageLoader } from "src/hooks/useLazyImageLoader";
import { logger } from "src/utils/logger";
import { useElementSize } from "src/hooks/useElementSize";
import { useVirtualScrollReader } from "src/hooks/useVirtualScrollReader";
import { useVirtualImageLoader } from "src/hooks/useVirtualImageLoader";
// import { useSinglePageReader } from "src/hooks/useSinglePageReader";
import { useRafScrollBinding } from "src/hooks/useRafScrollBinding";
import { useReaderProgressSaver } from "src/hooks/useReaderProgressSaver";
import { useReaderNeighborPreindex } from "src/hooks/useReaderNeighborPreindex";
import { useChapterList } from "src/hooks/useChapterList";
import { ReaderAnchor } from "src/types";

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавили плагин
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onChapterChange: (chapterName: string, resetPage?: boolean) => void
    onBack: () => void;
}

export const ReaderPage = ({ 
    app, 
    plugin, 
    parentPath, 
    chapterName, 
    onChapterChange, 
    onBack 
}: Props) => {
    // 1. Props / basic constants
    const t = translations[plugin.data.settings.language || "en"]
    const isMobile = (app as any).isMobile;

    // 2. Refs
    const containerRef = React.useRef<HTMLDivElement>(null);
    const pendingPositionKeyRef = React.useRef<string | null>(null);
    const pendingViewModeAnchorRef = React.useRef<{
        chapterName: string;
        pageIndex: number;
    } | null>(null);
    const lastSyncedVirtualPageRef = React.useRef<string | null>(null);

    // 3. Local state
    const [viewMode, setViewMode] = React.useState(plugin.data.settings.viewMode);
    const [isPositioning, setIsPositioning] = React.useState(true);

    // 4. Custom hooks 
    // 5. Destructure hook results
    // 6. Derived values
    // Не всегда удается разделить структуру
    const viewportSize = useElementSize(containerRef);

    const readerInitialPage = useReaderInitialPage(
        plugin,
        parentPath,
        chapterName
    );

    const [readerAnchor, setReaderAnchor] = React.useState<ReaderAnchor>(() => ({
        chapterName,
        pageIndex: readerInitialPage,
    }));

    const lazyLoader = useLazyImageLoader({
        parentPath,
        chapterName,
        bufferSize: 3,
        app,
        initialPage: readerInitialPage,
    });

    const {
        visibleIndex,           // ← Текущая видимая страница (единый источник правды)
        setVisible,             // Синхронизация visibleIndex для legacy image loader/single mode
        getTotalPages,
        getAllChapters,
        transitionToChapter,
        getTotalPagesForChapter,
        getCurrentChapter,      // ← Для получения актуальной главы но с мемо
        currentChapter,
        isReady,
    } = lazyLoader;

    const allChapters = useChapterList(app, parentPath);
    const totalPages = getTotalPages();

    // Переименовать наверное уже надо - этот хук для скролла
    // И так понятно, что это virtual DOM
    const virtualReader = useVirtualScrollReader({
        app,
        plugin,
        parentPath,
        anchor: readerAnchor,
        allChapters,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        pageGap: 16,
        maxPageWidth: 1200,
        overscan: 1000,
    });

    // const singlePageReader = useSinglePageReader_({
    //     app,
    //     plugin,
    //     parentPath,
    //     allChapters,
    //     anchor: readerAnchor,
    //     onAnchorChange: setReaderAnchor,
    // });

    const virtualImageLoader = useVirtualImageLoader({
        app,
        parentPath,
        readerLayout: virtualReader.readerLayout,
        visiblePages: virtualReader.visiblePages,
        activePage: virtualReader.activePage,
        retainBefore: 6,
        retainAfter: 8,
        loadConcurrency: 2,
    });

    useReaderNeighborPreindex({
        app,
        plugin,
        parentPath,
        allChapters,
        activeChapterName: virtualReader.activePage?.chapterName ?? currentChapter ?? chapterName,
        mode: "extended",
        enabled: viewMode === "scroll",
    });

    useRafScrollBinding(containerRef, virtualReader.onScroll);

    const {
        scheduleUpdate,
        flush
    } = useReaderProgressSaver(
        plugin,
        parentPath,
        500
    );

    // 6. Derived values
    const isReaderPreparing = virtualReader.isLoading || !isReady;
    const isReaderBusy = isReaderPreparing || isPositioning;
    const showReaderLoader = useMinimumVisible(isReaderBusy, 600);

    // 7. Callbacks / event handlers
    const toggleViewMode = React.useCallback(async () => {
        const newMode = viewMode === "scroll" ? "single" : "scroll";

        const anchor =
            viewMode === "scroll" && virtualReader.activePage
                ? {
                    chapterName: virtualReader.activePage.chapterName,
                    pageIndex: virtualReader.activePage.index,
                }
                : {
                    chapterName: currentChapter,
                    pageIndex: visibleIndex,
                };

        setReaderAnchor(anchor);
        pendingViewModeAnchorRef.current = anchor;

        if (anchor.chapterName !== currentChapter) {
            transitionToChapter(anchor.chapterName, anchor.pageIndex);
        } else {
            setVisible(anchor.pageIndex);
        }

        // Надежнее перед сменой режима заблокировать и указать что сейчас будет смена режима
        // Так scroll DOM не успеет появиться на мгновение
        setIsPositioning(true);

        // Обновляем визуальное состояние
        setViewMode(newMode);
        
        // Сохраняем в настройки плагина
        plugin.data.settings.viewMode = newMode;
        await plugin.saveSettings();
    },[
        viewMode,
        virtualReader.activePage,
        visibleIndex,
        currentChapter,
        setVisible,
        transitionToChapter,
        plugin,
    ]);

    const goToPage = React.useCallback(async (index: number, chapter: string) => {
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
    },[
        totalPages,
        allChapters,
        transitionToChapter,
        scheduleUpdate,
        getTotalPagesForChapter,
        setVisible,
    ]);

    // 8. Effects
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

    // При смене главы из пропс делаем принудительное сохранение данных на диск
    React.useEffect(() => {
        flush();
    }, [parentPath, chapterName, flush]);

    // Эффект для скролла наверх в постраничном режиме
    React.useEffect(() => {
        // Если мы в режиме "по страницам" и container есть
        // Значит можно делать scrollTo
        if (viewMode === "single" && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: "instant" });
        }
    }, [visibleIndex, viewMode]);

    // При смене режимов просмотра
    React.useEffect(() => {
        setReaderAnchor({
            chapterName,
            pageIndex: readerInitialPage,
        });
    }, [chapterName, readerInitialPage]);

    // Отслеживание активной страницы для useVirtualMangaReader
    // Основная движуха?
    React.useEffect(() => {
        const activePage = virtualReader.activePage;

        if (!activePage) return;
        if (virtualReader.isLoading) return;
        if (viewMode !== "scroll") return;

        const key = `${activePage.chapterName}:${activePage.index}`;

        // Защита от повторного запуска эффекта для одной страницы
        if (lastSyncedVirtualPageRef.current === key) {
            return;
        }

        lastSyncedVirtualPageRef.current = key;

        // Получаем текущую главу из хука
        const currentLazyChapter = getCurrentChapter();

        if (activePage.chapterName !== currentLazyChapter) {
            transitionToChapter(activePage.chapterName, activePage.index);
        } else {
            setVisible(activePage.index);
        }

        scheduleUpdate(activePage.index, activePage.chapterName);

        logger.virtualManager(
            `Virtual active synced to lazy loader: ${activePage.chapterName} #${activePage.index + 1}`
        );
    }, [
        virtualReader.activePage,
        virtualReader.isLoading,
        viewMode,
        setVisible,
        scheduleUpdate,
        getCurrentChapter,
        transitionToChapter,
    ]);

    // Запрос на разовое позиционирование после смены главы или режима просмотра
    React.useEffect(() => {
        const key = `${readerAnchor.chapterName}:${readerAnchor.pageIndex}:${viewMode}`;

        pendingPositionKeyRef.current = key;
        setIsPositioning(true);

        logger.ReaderPage(`Positioning requested: ${key}`);
    }, [
        readerAnchor.chapterName,
        readerAnchor.pageIndex,
        viewMode,
    ]);

    // Автоскролл до нужной страницы при загрузке или смене режима просмотра
    React.useEffect(() => {
        if (isReaderPreparing) return;

        const pendingKey = pendingPositionKeyRef.current;

        if (!pendingKey) return;

        const currentKey = `${readerAnchor.chapterName}:${readerAnchor.pageIndex}:${viewMode}`;

        if (pendingKey !== currentKey) return;

        logger.ReaderPage(`Positioning running: ${currentKey}`);

        const pendingAnchor = pendingViewModeAnchorRef.current;

        const targetChapterName = pendingAnchor?.chapterName ?? currentChapter;
        const targetPageIndex = pendingAnchor?.pageIndex ?? visibleIndex;

        if (viewMode === "scroll" && virtualReader.readerLayout) {
            const page = virtualReader.readerLayout.pages.find(page =>
                page.chapterName === targetChapterName &&
                page.index === targetPageIndex
            );

            if (!page) {
                logger.virtualManager(
                    `Positioning target not found yet: ${targetChapterName} page ${targetPageIndex + 1}`
                );
                return;
            }

            if (containerRef.current) {
                containerRef.current.scrollTo({
                    top: page.offsetTopInReader,
                    behavior: "instant",
                });

                logger.ReaderPage(
                    `Scrolled by layout to ${targetChapterName} page ${targetPageIndex + 1}`
                );
            }
        }

        setIsPositioning(false);
        pendingPositionKeyRef.current = null;
        pendingViewModeAnchorRef.current = null;
    }, [
        isReaderPreparing,
        chapterName, // пока тут лишний, но в будущем при смене главы пригодится? Хотя у меня при жесткой снеме - перезапуск всего ридера
        viewMode,
        virtualReader.readerLayout,
        visibleIndex,
        currentChapter,
    ]);

    // Делаем scrollTo по запросу хука при изменении окна
    React.useLayoutEffect(() => {
        if (virtualReader.pendingScrollTop === null) {
            return;
        }

        const container = containerRef.current;

        if (!container) {
            return;
        }

        container.scrollTo({
            top: virtualReader.pendingScrollTop,
            behavior: "instant",
        });

        virtualReader.ackPendingScroll();
    }, [
        virtualReader.pendingScrollTop,
        virtualReader.ackPendingScroll,
    ]);

    // 9. Early return
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

    // 10. Render
    return (
        <div className={`manga-reader ${showReaderLoader ? "is-reader-loading" : ""}`}>
            <MangaCanvas
                containerRef={containerRef}
                viewMode={viewMode}
                isMobile={isMobile}                
                onToggleViewMode={toggleViewMode}
                currentPage={visibleIndex}
                chapterName={currentChapter}
                allChapters={allChapters}
                onBack={onBack}
                onChapterChange={onChapterChange}
                onPageClick={(idx, ch) => goToPage(idx, ch)}
                imageProvider={lazyLoader}
                virtualImageProvider={virtualImageLoader}
                virtualReaderLayout={virtualReader.readerLayout}
                virtualVisiblePages={virtualReader.visiblePages}
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
