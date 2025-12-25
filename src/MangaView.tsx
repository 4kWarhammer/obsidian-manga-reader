import { ItemView, WorkspaceLeaf, TFolder, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
// Импортируем наш интерфейс-диспетчер для манги
import { MangaInterface } from "./MangaInterface";

export const VIEW_TYPE_MANGA = "manga-reader-view";

// Класс MangaView является тут "дверью" в Obsidian
export class MangaView extends ItemView {
    root: ReactDOM.Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_MANGA; }
    getDisplayText() { return "Manga Reader"; }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        this.root = ReactDOM.createRoot(container);
        
        // Передаем объект 'this.app' внутрь React, 
        // чтобы мы могли обращаться к файлам Obsidian
        this.root.render(
            // тут просто запускаем компонент, передавая ему app
            <React.StrictMode>
                <MangaInterface app={this.app} />
            </React.StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}