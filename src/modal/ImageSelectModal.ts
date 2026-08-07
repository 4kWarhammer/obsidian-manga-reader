import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { ImageSelectComponent } from "src/components/ImageSelectComponent";
import { renderWithI18n } from "src/i18n/renderWithI18n";
import type { Language } from "../i18n";

export class ImageSelectModal extends Modal {
    root: Root | null = null;
    private imagesFolder: string;
    private selectedPaths: string[];
    private onSave: (paths: string[]) => void;
    private language: Language;

    constructor(
        app: App,
        imagesFolder: string,
        selectedPaths: string[],
        onSave: (paths: string[]) => void,
        language: Language
    ) {
        super(app);
        this.imagesFolder = imagesFolder;
        this.selectedPaths = selectedPaths;
        this.onSave = onSave;
        this.language = language;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("image-select-modal");
        this.root = createRoot(contentEl);
        this.root.render(
            renderWithI18n(
                React.createElement(ImageSelectComponent, {
                    app: this.app,
                    imagesFolder: this.imagesFolder,
                    selectedPaths: this.selectedPaths,
                    onSave: this.onSave,
                    onClose: () => this.close(),
                }),
                this.language
            )
        );
    }

    onClose() {
        this.root?.unmount();
        this.contentEl.empty();
    }
}