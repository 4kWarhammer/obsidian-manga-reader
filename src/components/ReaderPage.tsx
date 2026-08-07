import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { usePluginSettings } from "src/hooks/usePluginSettings";
import { useReaderInitialPage } from "src/hooks/useReaderInitialPage";
import { useMinimumVisible } from "src/hooks/useMinimumVisible";
import { translations } from "src/i18n";
import { ReaderSettingsModal } from "src/modal/ReaderSettingsModal";
import { MangaCanvas } from "./ui/MangaCanvas";
import { logger } from "src/utils/logger";
import { useElementSize } from "src/hooks/useElementSize";
import { useVirtualScrollReader } from "src/hooks/useVirtualScrollReader";
import { useVirtualImageLoader } from "src/hooks/useVirtualImageLoader";
import { useSinglePageReader } from "src/hooks/useSinglePageReader";
import { useRafScrollBinding } from "src/hooks/useRafScrollBinding";
import { useReaderProgressSaver } from "src/hooks/useReaderProgressSaver";
import { useReaderNeighborPreindex } from "src/hooks/useReaderNeighborPreindex";
import { useTitleBackgroundPreindex } from "src/hooks/useTitleBackgroundPreindex";
import { useChapterList } from "src/hooks/useChapterList";
import { ReaderAnchor, PluginData } from "src/types";

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавили плагин
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onChapterChange: (chapterName: string, resetPage?: boolean) => void
    onBack: () => void;
}

// Для управления читалкой - шириной окна в частности
const MAX_WIDTH = 1200;
const OVERSCAN = 1000;

export const ReaderPage = ({ 
    app, 
    plugin, 
    parentPath, 
    chapterName, 
    onChapterChange, 
    onBack,
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
    const { settings, update } = usePluginSettings(plugin);
    const [viewMode, setViewMode] = React.useState(settings.viewMode);

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

    const allChapters = useChapterList(app, parentPath);

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
        pageGap: settings.pageGap,
        maxPageWidth: MAX_WIDTH * (settings.readerWidthPercent / 100),
        overscan: OVERSCAN,
    });

    const {
        scheduleUpdate,
        flush
    } = useReaderProgressSaver(
        plugin,
        parentPath,
        500
    );

    const singlePageReader = useSinglePageReader({
        app,
        plugin,
        parentPath,
        allChapters,
        readerLayout: virtualReader.readerLayout,
        anchor: readerAnchor,
        onAnchorChange: setReaderAnchor,
        onProgressSave: scheduleUpdate,
    });

    const imageVisiblePages =
        viewMode === "single" && singlePageReader.page
            ? [singlePageReader.page]
            : virtualReader.visiblePages;

    const imageActivePage =
        viewMode === "single"
            ? singlePageReader.page
            : virtualReader.activePage;

    // Может не только в scroll режиме уже...
    const virtualImageLoader = useVirtualImageLoader({
        app,
        parentPath,
        readerLayout: virtualReader.readerLayout,
        visiblePages: imageVisiblePages,
        activePage: imageActivePage,
        retainBefore: 6,
        retainAfter: 8,
        loadConcurrency: 2,
    });

    useTitleBackgroundPreindex({
        app,
        plugin,
        parentPath,
        chapters: allChapters,
        enabled: settings.readerBackgroundIndexing,
    });

    useReaderNeighborPreindex({
        app,
        plugin,
        parentPath,
        allChapters,
        // Работать должен в любом режиме
        activeChapterName: virtualReader.activePage?.chapterName ?? readerAnchor.chapterName,
        mode: settings.indexWarmerMode,
        enabled: true,
    });

    useRafScrollBinding(containerRef, virtualReader.onScroll);


    // 6. Derived values
    const isReaderPreparing =
        viewMode === "scroll"
            ? virtualReader.isLoading || !virtualReader.readerLayout
            : !singlePageReader.isReady;

    const isReaderBusy = isReaderPreparing || isPositioning;
    const showReaderLoader = useMinimumVisible(isReaderBusy, 600);

    // 7. Callbacks / event handlers
    const ontoggleViewMode = () => {
        const newMode = viewMode === "scroll" ? "single" : "scroll";
        update("viewMode", newMode);
    };

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

    // Если настройки изменились извне (например, в модалке настроек),
    // синхронизируем локальный стейт.
    React.useEffect(() => {
        if (viewMode === settings.viewMode) return;
        
        // viewMode — это ещё СТАРЫЙ режим в момент срабатывания.
        // Именно то, что нам нужно для вычисления anchor.
        const oldMode = viewMode;
        const newMode = settings.viewMode;
        
        setViewMode(newMode);
        
        const anchor =
            oldMode === "scroll" && virtualReader.activePage
                ? {
                    chapterName: virtualReader.activePage.chapterName,
                    pageIndex: virtualReader.activePage.index,
                }
                : {
                    chapterName: singlePageReader.chapterName,
                    pageIndex: singlePageReader.pageIndex,
                };

        setReaderAnchor(anchor);
        
        if (newMode === "scroll") {
            setIsPositioning(true);
        } else {
            setIsPositioning(false);
        }
    }, [
        settings.viewMode,
        viewMode,
        virtualReader.activePage,
        singlePageReader.chapterName,
        singlePageReader.pageIndex
    ]);

    // При смене главы из пропс делаем принудительное сохранение данных на диск
    React.useEffect(() => {
        flush();
    }, [parentPath, chapterName, flush]);

    // Эффект для скролла наверх в постраничном режиме
    React.useLayoutEffect(() => {
        if (viewMode !== "single") {
            return;
        }

        containerRef.current?.scrollTo({
            top: 0,
            behavior: "instant",
        });
    }, [
        viewMode,
        singlePageReader.chapterName,
        singlePageReader.pageIndex,
    ]);

    // При первом открытии, можно так то переписать под разовое выполнение
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

        // А раньше набыло тут nextAnchor но как то же работал скролл
        // Это не мое предложение, посмотрю потом
        // const nextAnchor = {
        //     chapterName: activePage.chapterName,
        //     pageIndex: activePage.index,
        // };

        // setReaderAnchor(prev => {
        //     if (
        //         prev.chapterName === nextAnchor.chapterName &&
        //         prev.pageIndex === nextAnchor.pageIndex
        //     ) {
        //         return prev;
        //     }

        //     return nextAnchor;
        // });

        scheduleUpdate(activePage.index, activePage.chapterName);

        logger.virtualManager(
            `Virtual active synced to lazy loader: ${activePage.chapterName} #${activePage.index + 1}`
        );
    }, [
        virtualReader.activePage,
        virtualReader.isLoading,
        viewMode,
        scheduleUpdate,
    ]);

    // Запрос на разовое позиционирование после смены главы или режима просмотра
    React.useEffect(() => {
        if (viewMode !== "scroll") {
            pendingPositionKeyRef.current = null;
            pendingViewModeAnchorRef.current = null;
            setIsPositioning(false);
            return;
        }

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

        const targetChapterName = readerAnchor.chapterName;
        const targetPageIndex = readerAnchor.pageIndex;

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
        viewMode,
        virtualReader.readerLayout,
        readerAnchor.chapterName,
        readerAnchor.pageIndex,
    ]);

    // Делаем scrollTo по запросу хука при изменении окна в scroll mode
    React.useLayoutEffect(() => {
        // Без него single mode также будет подвержен его работе
        if (viewMode !== "scroll") {
            return;
        }
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
        viewMode,
        virtualReader.pendingScrollTop,
        virtualReader.ackPendingScroll,
    ]);

    // 9. Early return
    // Пока простая заглушка на случай ошибки
    if (virtualReader.error) {
        return (
            <div className="reader-error">
                <button onClick={onBack}>{t.common.back}</button>
                <p>Failed to index chapter metadata.</p>
                <pre>{virtualReader.error}</pre>
            </div>
        );
    }

    // 10. Render
    return (
        <div className={`manga-reader ${showReaderLoader ? "is-reader-loading" : ""}`}>
            <MangaCanvas
                app={app}
                plugin={plugin}
                containerRef={containerRef}
                viewMode={viewMode}
                isMobile={isMobile}
                onToggleViewMode={ontoggleViewMode}
                // onOpenSettings={handleOpenSettings} // Для окна настроек
                currentPage={readerAnchor.pageIndex}
                // Ну тут бардак
                chapterName={
                    viewMode === "scroll"
                        ? virtualReader.activePage?.chapterName ?? readerAnchor.chapterName
                        : singlePageReader.chapterName
                }
                allChapters={allChapters}
                onBack={onBack}
                onChapterChange={onChapterChange}
                virtualImageProvider={virtualImageLoader}
                virtualReaderLayout={virtualReader.readerLayout}
                virtualVisiblePages={virtualReader.visiblePages}
                singlePage={singlePageReader.page}
                onPageClick={(idx) => singlePageReader.goToPage(idx)}
            />

            {showReaderLoader && (
                <div className="manga-reader-global-loader">
                    <div className="spinner"></div>
                    <div className="manga-reader-global-loader-text">
                        {virtualReader.indexingProgress
                            ? `Indexing ${virtualReader.indexingProgress.loaded}/${virtualReader.indexingProgress.total}`
                            : t.common.loading}
                    </div>
                </div>
            )}
        </div>
    );
};
