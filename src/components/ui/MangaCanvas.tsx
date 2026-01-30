import * as React from "react";
import { MangaPage } from "./MangaPage";
import { ReaderHeader } from "./ReaderHeader";

interface MangaCanvasProps {
    containerRef: React.RefObject<HTMLDivElement>
    isLoading: boolean;
    viewMode: "scroll" | "single";
    isMobile?: boolean;
    onToggleViewMode: () => void;
    loadedChapters: { chapterName: string; images: string[] }[];
    currentPage: number;
    chapterName: string; // текущая активная глава из пропсов
    allChapters: string[],
    onBack:() => void,
    onChapterChange:(chapterName: string, resetPage?: boolean) => void,
    images: string[];    // изображения текущей главы (для single mode)
    onPageClick: (index: number, chName: string) => void;
    hasNextChapter: boolean;
}

// Это наш "диспетчер" для отображаемых элементов
export const MangaCanvas = ({ 
    containerRef,
    isLoading,
    viewMode,
    isMobile,
    onToggleViewMode,
    loadedChapters, 
    currentPage, 
    chapterName, 
    allChapters, 
    onBack, 
    onChapterChange, 
    images, 
    onPageClick, 
    hasNextChapter 
}: MangaCanvasProps) => {
    const [showUI, setShowUI] = React.useState(false);

    // Обработчик клика/тапа по канвасу
    // Возможно проблема - в скролле нам не нужны клики с onPageClick
    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const screenWidth = window.innerWidth;
        const tapZone = 0.2; // 20% ширины экрана

        if (viewMode === "single") {
            // Если нажали в левые 20%
            if (clientX < screenWidth * tapZone) {
                onPageClick(currentPage - 1, chapterName); // Листаем назад
            } 
            // Если нажали в правые 20%
            else if (clientX > screenWidth * (1 - tapZone)) {
                onPageClick(currentPage + 1, chapterName); // Листаем вперед
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

    // Диспетчер состояний: если грузимся - рисуем только лоадер
    if (isLoading) {
        return (
            <div className="manga-reader-loading">
                <div className="spinner"></div>
                <p>Загрузка контента...</p>
            </div>
        );
    }

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
                />
            </div>

            {viewMode === "scroll" ? (
                // Диспетчер режимов: Скролл
                <div 
                className="manga-reader-container scroll-mode"
                onClick={handleCanvasClick}
                >
                    {loadedChapters.map((chapter) => (
                        <div key={chapter.chapterName} className="manga-chapter-section">
                            {chapter.images.map((url, idx) => (
                                <MangaPage 
                                    key={url} 
                                    url={url} 
                                    index={idx} 
                                    chapterName={chapter.chapterName}
                                />
                            ))}
                        </div>
                    ))}
                    
                    <div id="end-of-list-sensor" className="manga-sensor">
                        {hasNextChapter ? "Загрузка следующей главы..." : "Конец истории"}
                    </div>
                </div>
            ) : (
                // Диспетчер режимов: Постранично
                <div 
                className="manga-reader-container single-mode"
                onClick={handleCanvasClick}
                >
                    {images.length > 0 && (
                        <MangaPage 
                            url={images[currentPage]} 
                            index={currentPage} 
                            chapterName={chapterName}
                            onClick={onPageClick} 
                        />
                    )}
                </div>
            )}
        </div>
    )
};