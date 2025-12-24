import { ItemView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

export const VIEW_TYPE_MANGA = "manga-reader-view";

// Простой компонент-заглушка
const MangaInterface = () => {
    return (
        <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: 'var(--text-accent)' 
        }}>
            <h2>📖 Читалка манги</h2>
            <p>React успешно подключен!</p>
        </div>
    );
};

export class MangaView extends ItemView {
    root: ReactDOM.Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() { return VIEW_TYPE_MANGA; }
    getDisplayText() { return "Manga Reader"; }

    async onOpen() {
        // Контейнер, куда мы «вставим» React
        const container = this.containerEl.children[1] as HTMLElement;
        this.root = ReactDOM.createRoot(container);
        this.root.render(
            <React.StrictMode>
                <MangaInterface />
            </React.StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}