// src/modals/FolderSelectModal.ts
import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { FolderBrowser } from "../components/FolderBrowser";

export class FolderSelectModal extends Modal {
    root: Root | null = null;
    onSelect: (path: string) => void;
    mode: "vault" | "external"


    constructor(app: App, onSelect: (path: string,) => void, mode: "vault" | "external") {
        super(app);
        this.onSelect = onSelect;
        this.mode = mode
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Очищаем контейнер модалки
        this.root = createRoot(contentEl);
        this.root.render(
            React.createElement(FolderBrowser, {
                app: this.app,
                mode: this.mode,
                onSelect: (path: string) => {
                    this.onSelect(path);
                    this.close();
                },
                onClose: () => this.close()
            })
        );
    }

    onClose() {
        this.root?.unmount();
    }
}