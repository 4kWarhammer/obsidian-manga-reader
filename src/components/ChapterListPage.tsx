import * as React from "react";
import { TFolder, App, Plugin } from "obsidian";
import { useChapterList } from "src/hooks/useChapterList";
import { translations } from "src/i18n";
import MangaReaderPlugin from "src/main";

// Достаем Node.js модули
const fs = (window as any).require ? (window as any).require('fs') : null;

interface Props {
    plugin: MangaReaderPlugin;
    chapters: string[];
    onSelectChapter: (chapterName: string, resetPage?: boolean) => void;
}

export const ChapterListPage = ({ plugin, chapters, onSelectChapter }: Props) => {
    const t = translations[plugin.data.settings.language || "en"];

    return (
        <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {chapters.length > 0 ? (
                    chapters.map(name => (
                        <div
                            key={name}
                            onClick={() => onSelectChapter(name, true)}
                            style={{
                                padding: "12px",
                                background: "var(--background-secondary)",
                                borderRadius: "4px",
                                cursor: "pointer",
                                borderLeft: "4px solid var(--interactive-accent)"
                            }}
                        >
                            {name}
                        </div>
                    ))
                ) : (
                    <p>{t.nochapters}</p>
                )}
            </div>
        </div>
    );
};