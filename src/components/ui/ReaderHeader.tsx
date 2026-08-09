import * as React from "react";
import * as Lucide from "lucide-react";
import { useI18n } from "src/i18n/I18nContext";

interface ReaderHeaderProps {
    chapterName: string;
    chapterIndex: number;
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
    chapterIndex, 
    onBack, 
    viewMode, 
    onToggleViewMode, 
    onOpenSettings, 
    onOpenChapterList, 
}: ReaderHeaderProps) => {
    const { t } = useI18n();

    return (
        <div className="reader-header">
            <div className="header-left">
                <button 
                    className="nav-btn" 
                    onClick={onBack} 
                    title={t.common.back}>
                    <Lucide.ArrowLeft/>
                </button>
            </div>
            
            <div className="header-center">
                {/* Эти кнопки не нужны, если и делать, то как перемещение по главам */}
                {/* <button 
                    className="nav-btn"
                    onClick={() => onPageNavigation("prev")}
                    title="Предыдущая страница"
                >
                    <Lucide.ChevronLeft size={25}/>
                </button> */}

                {/* Вместо <select> */}
                <button
                    className="nav-btn"
                    onClick={onOpenChapterList}
                    title={t.reader.header.content}
                >
                    {/* <span className="toc-trigger-label">Оглавление</span> */}
                    <span className="header-chaptername">{t.reader.header.chapter} {chapterIndex + 1}</span>
                </button>

                {/* <button
                    className="nav-btn"
                    onClick={() => onPageNavigation("next")}
                    title="Следующая страница"
                    >
                    <Lucide.ChevronRight size={25}/>
                </button> */}
            </div>

            <div className="header-right">
                {/* Переключение режимов просмотра */}
                <button 
                    className="nav-btn"
                    onClick={onToggleViewMode}
                    title={viewMode === "scroll"
                        ? `${t.settings.viewMode}: ${t.settings.scroll}`
                        : `${t.settings.viewMode}: ${t.settings.singlePage}`
                    }
                >
                    {viewMode === "scroll" 
                    ? <Lucide.GalleryVertical/>
                    : <Lucide.FileText/>}
                </button>
                {/* Настройки */}
                <button 
                    className="nav-btn" 
                    onClick={onOpenSettings} 
                    title={t.reader.header.settings}
                >
                    <Lucide.Settings/>
                </button>
            </div>
        </div>
    );
};