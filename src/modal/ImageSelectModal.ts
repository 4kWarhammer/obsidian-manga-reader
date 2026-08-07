import { App, Modal, TFolder, TFile } from "obsidian";
import { getTranslation } from "../i18n";
import type { Language, Translation } from "../i18n";

// Пока тут типы
interface ImageFileInfo {
    path: string;
    name: string;
    folder: string;
    resourcePath: string;
}

interface FolderNode {
    folder: TFolder;
    name: string;
    files: ImageFileInfo[];
    children: FolderNode[];
}

// Это ваще интересно, не стал в i18n писать
const TEXTS: Record<string, Record<string, string>> = {
    ru: { 
        selectImages: "Выбор изображений", 
        save: "Сохранить", 
        cancel: "Отмена", 
        empty: "Изображения не найдены" 
    },
    en: { 
        selectImages: "Select images", 
        save: "Save", 
        cancel: "Cancel", 
        empty: "No images found" },
};

export class ImageSelectModal extends Modal {
    private imagesFolder: string;
    private onSave: (paths: string[]) => void;
    private selectedPaths: Set<string>;
    private imageFiles: ImageFileInfo[] = [];
    private rootNode: FolderNode | null = null;
    private folderExpanded: Map<string, boolean> = new Map();
    private t: Translation;

    constructor(
        app: App,
        imagesFolder: string,
        selectedPaths: string[],
        onSave: (paths: string[]) => void,
        language: Language
    ) {
        super(app);
        this.imagesFolder = imagesFolder;
        this.selectedPaths = new Set(selectedPaths);
        this.onSave = onSave;
        this.t = getTranslation(language);
    }


    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("image-select-modal");

        this.titleEl.setText(this.t.modal.imageSelect.headerName);

        this.collectImages();

        const container = contentEl.createDiv({ cls: "image-select-container" });

        if (!this.rootNode || (this.rootNode.files.length === 0 && this.rootNode.children.length === 0)) {
            container.createDiv({ text: this.t.modal.imageSelect.empty, cls: "image-select-empty" });
        } else {
            // Корень не рендерим как папку — сразу его содержимое
            for (const child of this.rootNode.children) {
                this.renderFolderNode(container, child, 0);
            }
            for (const file of this.rootNode.files) {
                this.renderFile(container, file, 0);
            }
        }

        const footer = contentEl.createDiv({ cls: "image-select-footer" });

        const saveBtn = footer.createEl("button", { text: this.t.common.save, cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            this.onSave(Array.from(this.selectedPaths));
            this.close();
        });

        const cancelBtn = footer.createEl("button", { text: this.t.common.cancel });
        cancelBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }

    /**
     * Метод сбора изображений внутри папаки
     */
    private collectImages() {
        const folder = this.app.vault.getAbstractFileByPath(this.imagesFolder);
        if (!(folder instanceof TFolder)) return;
        this.rootNode = this.buildNode(folder);
    }

    /**Строим файловую структуру */
    private buildNode(folder: TFolder): FolderNode {
        const node: FolderNode = {
            folder,
            name: folder.name,
            files: [],
            children: [],
        };

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                node.children.push(this.buildNode(child));
            } else if (child instanceof TFile && this.isImage(child.extension)) {
                // Тут пушим изображение
                node.files.push({
                    path: child.path,
                    name: child.name,
                    folder:folder.path,
                    resourcePath: this.app.vault.getResourcePath(child),
                });
            }
        }

        node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        return node;
    }

    private isImage(ext: string): boolean {
        return ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext.toLowerCase());
    }

    /**Все файлы в поддереве (для чекбокса папки) */
    private getSubtreeFiles(node: FolderNode): ImageFileInfo[] {
        const result = [...node.files];
        for (const child of node.children) {
            result.push(...this.getSubtreeFiles(child));
        }
        return result;
    }

    private renderFolderNode(container: HTMLElement, node: FolderNode, depth: number) {
        const folderWrap = container.createDiv({ cls: "image-select-folder" });

        const header = folderWrap.createDiv({ cls: "folder-header" });
        header.style.paddingLeft = `${8 + depth * 16}px`;

        // Чекбокс
        const cb = header.createEl("input", { type: "checkbox" });
        cb.style.margin = "0";
        const subtreeFiles = this.getSubtreeFiles(node);
        const allSelected = subtreeFiles.length > 0 && subtreeFiles.every(f => this.selectedPaths.has(f.path));
        const someSelected = subtreeFiles.some(f => this.selectedPaths.has(f.path));
        cb.checked = allSelected;
        (cb as HTMLInputElement).indeterminate = someSelected && !allSelected;

        // Стрелка
        const arrow = header.createSpan({ cls: "folder-arrow" });
        const expanded = this.folderExpanded.get(node.folder.path) ?? false;
        arrow.textContent = expanded ? "▼" : "▶";

        // Имя
        header.createSpan({ text: `📁 ${node.name}`, cls: "folder-name" });

        // Контент (файлы + вложенные папки)
        const content = folderWrap.createDiv({ cls: "folder-content" });
        if (!expanded) content.style.display = "none";

        header.addEventListener("click", (e) => {
            if (e.target === cb) return;
            const nowExpanded = content.style.display === "none";
            content.style.display = nowExpanded ? "block" : "none";
            this.folderExpanded.set(node.folder.path, nowExpanded);
            arrow.textContent = nowExpanded ? "▼" : "▶";
        });

        cb.addEventListener("change", () => {
            const checked = cb.checked;
            for (const file of subtreeFiles) {
                if (checked) this.selectedPaths.add(file.path);
                else this.selectedPaths.delete(file.path);
            }
            this.refresh();
        });

        // Подпапки внутри этой же папки
        for (const child of node.children) {
            this.renderFolderNode(content, child, depth + 1);
        }

        // Файлы этой папки
        for (const file of node.files) {
            this.renderFile(content, file, depth + 1);
        }
    }

    private renderFile(container: HTMLElement, file: ImageFileInfo, depth: number) {
        // Тут и стили прописаны - не хорошо скорее всего - я потом потеряю их
        const item = container.createDiv({ cls: "image-item" });
        item.style.paddingLeft = `${12 + depth * 16}px`;

        const cb = item.createEl("input", { type: "checkbox" });
        cb.checked = this.selectedPaths.has(file.path);
        cb.style.margin = "0";

        const img = item.createEl("img");
        img.src = file.resourcePath;
        img.alt = file.name;

        item.createSpan({ text: file.name });

        cb.addEventListener("change", () => {
            if (cb.checked) this.selectedPaths.add(file.path);
            else this.selectedPaths.delete(file.path);
            this.refresh();
        });
    }

    private refresh() {
        const scroll = this.contentEl.querySelector(".image-select-container")?.scrollTop ?? 0;
        this.contentEl.empty();
        this.onOpen();
        const container = this.contentEl.querySelector(".image-select-container");
        if (container) container.scrollTop = scroll;
    }

    // Сейчас уже не нужна, но может вынести логику?
    private updateFileCheckboxes(container: HTMLElement, files: ImageFileInfo[]) {
        const items = container.querySelectorAll(".image-item");
        files.forEach((file, i) => {
            const item = items[i];
            if (!item) return;
            const cb = item.querySelector("input[type='checkbox']") as HTMLInputElement;
            if (cb) cb.checked = this.selectedPaths.has(file.path);
        });
    }
}