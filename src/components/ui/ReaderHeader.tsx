import { Plugin } from "obsidian";
import * as React from "react";
import * as Lucide from "lucide-react";

interface ReaderHeaderProps {
    chapterName: string;
    allChapters: string[];
    onBack: () => void;
    onChapterChange: (name: string) => void;
    viewMode: string;
    onToggleViewMode?: () => void;
    onOpenSettings?: () => void
}

export const ReaderHeader = ({ 
    chapterName, 
    allChapters, 
    onBack, 
    onChapterChange, 
    viewMode,
    onToggleViewMode,
    onOpenSettings,
}: ReaderHeaderProps) => {
    return (
        <div className="reader-header">
            <div className="header-left">
                <button className="nav-btn" onClick={onBack} title="Назад">
                    <span>🔙</span>
                </button>
            </div>
            
            <div className="header-center">
                <select 
                    value={chapterName} 
                    onChange={(e) => onChapterChange(e.target.value)}
                    className="chapter-select"
                >
                    {allChapters.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                    ))}
                </select>
            </div>

            <div className="header-right">
                {/* Переключение режимов просмотра */}
                <button 
                    className="nav-btn"
                    onClick={onToggleViewMode}
                    title="Сменить режим">
                    {viewMode === "scroll" ? "📜" : "📄"}
                </button>
                {/* Настройки */}
                <button 
                    className="nav-btn" 
                    onClick={onOpenSettings} 
                    title="Настройки"
                >
                    <span>⚙️</span>
                </button>
            </div>
        </div>
    );
};