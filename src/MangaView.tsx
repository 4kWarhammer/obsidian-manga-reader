import { ItemView, WorkspaceLeaf, TFolder, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
// Импортируем наш интерфейс-диспетчер для манги
import { MangaInterface } from "./MangaInterface";
// Импортируем класс твоего плагина
import MangaReaderPlugin from "./main"; 

export const VIEW_TYPE_MANGA = "manga-reader-view";

// Класс MangaView является тут "дверью" в Obsidian
// чисто делает так, чтобы плагин нормально дружил в ним
export class MangaView extends ItemView {
    root: ReactDOM.Root | null = null;
    plugin: MangaReaderPlugin; // Создаем место для хранения ссылки на плагин

    // Обновляем конструктор: теперь он ждет (leaf, plugin)
    constructor(leaf: WorkspaceLeaf, plugin: MangaReaderPlugin) {
        super(leaf);
        this.plugin = plugin; // Сохраняем плагин в класс
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
                {/* Теперь мы можем передать данные плагина в React */}
                <MangaInterface 
                    app={this.app} 
                    plugin={this.plugin} 
                />
            </React.StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}