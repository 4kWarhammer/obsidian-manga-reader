import * as React from "react";
import { MangaPage } from "./MangaPage";
import { ReaderHeader } from "./ReaderHeader";
import { VirtualImageProvider } from "src/types";
import { ReaderLayout, ReaderPageLayout } from "src/types";
import { VirtualScrollSurface } from "./VirtualScrollSurface";

interface MangaCanvasProps {
    containerRef: React.RefObject<HTMLDivElement | null>
    viewMode: "scroll" | "single";
    isMobile?: boolean;
    onToggleViewMode: () => void;
    onOpenSettings?: () => void; // для окна настроек
    currentPage: number;
    chapterName: string;
    allChapters: string[],
    onBack:() => void,
    onChapterChange:(chapterName: string, resetPage?: boolean) => void,
    onPageClick: (pageIndex: number) => Promise<void>;
    virtualImageProvider: VirtualImageProvider;
    virtualReaderLayout: ReaderLayout | null;
    virtualVisiblePages: ReaderPageLayout[];
    singlePage: ReaderPageLayout | null;
}

// Это наш "диспетчер" для отображаемых элементов
export const MangaCanvas = React.memo(({ 
    containerRef,
    viewMode,
    isMobile,
    onToggleViewMode,
    onOpenSettings,
    currentPage, 
    chapterName, 
    allChapters, 
    onBack, 
    onChapterChange, 
    onPageClick,
    virtualImageProvider,
    virtualReaderLayout,
    virtualVisiblePages,
    singlePage,
}: MangaCanvasProps) => {
    const [showUI, setShowUI] = React.useState(false);

    const singleKey = singlePage
        ? `${singlePage.chapterName}:${singlePage.index}`
        : null;

    /**
     * Универсальный обработчик кликов по канвасу
     * В scroll mode - вызывает header UI
     * В single mode - навигация по страницам
     */
    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const screenWidth = window.innerWidth;
        const tapZone = 0.2; // 20% ширины экрана

        if (!singlePage) {
            return;
        }

        if (viewMode === "single") {
            // Если нажали в левые 20%
            if (clientX < screenWidth * tapZone) {
                onPageClick(singlePage.index - 1); // Листаем назад
            } 
            // Если нажали в правые 20%
            else if (clientX > screenWidth * (1 - tapZone)) {
                onPageClick(singlePage.index + 1); // Листаем вперед
            } 
            // Если нажали в центр — переключаем UI хедера
            else {
                setShowUI(!showUI);
            }
        } else {
            setShowUI(!showUI);
        }
    };

    // При монтировании (открытии читалки) добавляем класс к боди
    React.useEffect(() => {
        document.body.classList.add("is-reader-active");
        return () => {
            document.body.classList.remove("is-reader-active");
        };
    }, []);

    return (
        <div 
            ref={containerRef} 
            className="manga-canvas-root"
            // Останавливаем всплытие событий тача, чтобы Obsidian не реагировал на них
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            // onTouchEnd не всегда нужен, но можно добавить для надежности
        >

            {/* Контейнер-триггер, который всегда приклеен к топу */}
            <div className={`header-wrapper ${isMobile && showUI ? "is-mobile-visible" : ""}`}>
                <ReaderHeader 
                    chapterName={chapterName}
                    allChapters={allChapters}
                    onBack={onBack}
                    onChapterChange={(name) => onChapterChange(name, true)}
                    viewMode={viewMode}
                    onToggleViewMode={onToggleViewMode}
                    onOpenSettings={onOpenSettings} // для окна настроек
                />
            </div>

            {viewMode === "scroll" ? (
                // Диспетчер режимов: Скролл
                <div 
                className="manga-reader-container scroll-mode"
                onClick={handleCanvasClick}
                >
                    {virtualReaderLayout ? (
                        <VirtualScrollSurface
                            readerLayout={virtualReaderLayout}
                            visiblePages={virtualVisiblePages}
                            imageProvider={virtualImageProvider}
                        />
                    ) : null} 
                </div>
            ) : (
                // Диспетчер режимов: Постранично
                <div 
                className="manga-reader-container single-mode"
                onClick={handleCanvasClick}
                >
                    <MangaPage
                        url={singleKey ? virtualImageProvider.loadedUrls.get(singleKey) || undefined : undefined}
                        isLoading={singlePage ? virtualImageProvider.isLoading(singlePage.chapterName, singlePage.index) : false}
                        index={singlePage?.index ?? currentPage}
                        chapterName={singlePage?.chapterName ?? chapterName}
                        style={singlePage ? {
                            width: singlePage.renderedWidth,
                            height: singlePage.renderedHeight,
                            margin: '0 auto',
                        } : undefined}
                    />
                </div>
            )}
        </div>
    )
});
