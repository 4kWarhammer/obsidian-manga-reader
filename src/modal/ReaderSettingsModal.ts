import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import MangaReaderPlugin from "src/main";
import { ReaderSettings } from "src/components/ReaderSettings";
import { renderWithI18n } from "src/i18n/renderWithI18n";

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
            renderWithI18n(
                React.createElement(ReaderSettings, {
                    plugin: this.plugin,
                    onClose: () => this.close(),
                }),
                this.plugin.data.settings.language
            )

        );
    }

    onClose() {
        this.root?.unmount();
        this.contentEl.empty();
    }
}