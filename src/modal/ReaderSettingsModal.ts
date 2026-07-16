import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import MangaReaderPlugin from "src/main";
import { ReaderSettings } from "src/components/ReaderSettings";

export class ReaderSettingsModal extends Modal {
    root: Root | null = null;
    plugin: MangaReaderPlugin;

    constructor(app: App, plugin: MangaReaderPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(ReaderSettings, {
                plugin: this.plugin,
                onClose: () => this.close(),
            })
        );
    }

    onClose() {
        this.root?.unmount();
        this.contentEl.empty();
    }
}