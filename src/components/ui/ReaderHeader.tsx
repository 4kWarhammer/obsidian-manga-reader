import * as React from "react";
import * as Lucide from "lucide-react";

interface ReaderHeaderProps {
    chapterName: string;
    allChapters: string[];
    onBack: () => void;
    onPageNavigation: (direction: "prev" | "next") => void;
    onChapterChange: (name: string) => void;
    viewMode: string;
    onToggleViewMode?: () => void;
    onOpenSettings?: () => void
    onOpenChapterList?: () => void;
}

export const ReaderHeader = ({ 
    chapterName, 
    allChapters, 
    onBack,
    onPageNavigation,
    onChapterChange, 
    viewMode,
    onToggleViewMode,
    onOpenSettings,
    onOpenChapterList,
}: ReaderHeaderProps) => {
    const [isTocOpen, setIsTocOpen] = React.useState(false);

    return (
        <div className="reader-header">
            <div className="header-left">
                <button className="nav-btn" onClick={onBack} title="Назад">
                    <Lucide.ArrowLeft size={18}/>
                </button>
            </div>
            
            <div className="header-center">
                <button 
                    className="nav-btn"
                    onClick={() => onPageNavigation("prev")}
                    title="Предыдущая страница"
                >
                    <Lucide.ChevronLeft size={18}/>
                </button>

                {/* Вместо <select> */}
                <button
                    className="nav-btn"
                    onClick={onOpenChapterList}
                    title="Открыть оглавление"
                >
                    <span className="toc-trigger-label">Оглавление</span>
                    <span className="toc-trigger-current">{chapterName}</span>
                </button>

                <button
                    className="nav-btn"
                    onClick={() => onPageNavigation("next")}
                    title="Следующая страница"
                    >
                    <Lucide.ChevronRight size={18}/>
                </button>
            </div>

            <div className="header-right">
                {/* Переключение режимов просмотра */}
                <button 
                    className="nav-btn"
                    onClick={onToggleViewMode}
                    title="Сменить режим">
                    {viewMode === "scroll" 
                    ? <Lucide.GalleryVertical size={18}/>
                    : <Lucide.FileText size={18}/>}
                </button>
                {/* Настройки */}
                <button 
                    className="nav-btn" 
                    onClick={onOpenSettings} 
                    title="Настройки"
                >
                    <Lucide.Settings size={18}/>
                </button>
            </div>
        </div>
    );
};