import { Plugin } from "obsidian";
import * as React from "react";

interface ReaderHeaderProps {
    chapterName: string;
    allChapters: string[];
    onBack: () => void;
    onChapterChange: (name: string) => void;
    viewMode: string;
    onToggleViewMode?: () => void;
    // Сюда позже добавим пропсы для настроек
}

export const ReaderHeader = ({ 
    chapterName, 
    allChapters, 
    onBack, 
    onChapterChange, 
    viewMode,
    onToggleViewMode,
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
                <button className="nav-btn" onClick={onToggleViewMode} title="Сменить режим">
                    {viewMode === "scroll" ? "📜" : "📄"}
                </button>
            </div>
        </div>
    );
};