import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import MangaReaderPlugin from "src/main";
import { ChapterListPage } from "src/components/ChapterListPage";
import { renderWithI18n } from "src/i18n/renderWithI18n";

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
            renderWithI18n(
                React.createElement(ChapterListPage, {
                    chapters: this.chapters,
                    onSelectChapter: (name: string) => {
                        this.onSelectChapter(name);
                        this.close();
                    },
                    header: true,
                    onClose: () => this.close(),
                }),
                this.plugin.data.settings.language
            )


        );
    }

    onClose() {
        this.root?.unmount();
        this.root = null;
        this.contentEl.empty();
    }
}