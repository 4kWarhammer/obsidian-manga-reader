import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import MangaReaderPlugin from "src/main";
import { ChapterListPage } from "src/components/ChapterListPage";

export class ChapterListModal extends Modal {
    root: Root | null = null;
    plugin: MangaReaderPlugin;
    chapters: string[];
    onSelectChapter: (chapterName: string) => void;

    constructor(
        app: App,
        plugin: MangaReaderPlugin,
        chapters: string[],
        onSelectChapter: (chapterName: string) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.chapters = chapters;
        this.onSelectChapter = onSelectChapter;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.root = createRoot(contentEl);

        this.root.render(
            React.createElement(ChapterListPage, {
                plugin: this.plugin,
                chapters: this.chapters,
                onSelectChapter: (name: string) => {
                    this.onSelectChapter(name);
                    this.close();   // Закрываем после выбора главы
                },
            })
        );
    }

    onClose() {
        this.root?.unmount();
        this.contentEl.empty();
    }
}