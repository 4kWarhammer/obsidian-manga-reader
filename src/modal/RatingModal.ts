import { App, Modal } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { TitleRating } from "src/components/TitleRating";
import { renderWithI18n } from "src/i18n/renderWithI18n";
import type { Language } from "../i18n";

export class RatingModal extends Modal {
    root: Root | null = null;
    private initialRating: number;
    private onSave: (rating: number) => void;
    private language: Language;

    constructor(
        app: App,
        initialRating: number | null | undefined,
        onSave: (rating: number) => void,
        language: Language
    ) {
        super(app);
        this.initialRating = initialRating ?? 0;
        this.onSave = onSave;
        this.language = language;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.root = createRoot(contentEl);
        this.root.render(
            renderWithI18n(
                React.createElement(TitleRating, {
                    initialRating: this.initialRating,
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