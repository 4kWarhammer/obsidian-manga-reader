import { App, Modal, TFolder, TFile } from "obsidian";

// Пока тут типы
interface ImageFileInfo {
    path: string;
    name: string;
    folder: string;
    resourcePath: string;
}

// Это важе интересно, не стал в i18n писать
const TEXTS: Record<string, Record<string, string>> = {
    ru: { selectImages: "Выбор изображений", save: "Сохранить", cancel: "Отмена", empty: "Изображения не найдены" },
    en: { selectImages: "Select images", save: "Save", cancel: "Cancel", empty: "No images found" },
};

export class ImageSelectModal extends Modal {
    private imagesFolder: string;
    private onSave: (paths: string[]) => void;
    private selectedPaths: Set<string>;
    private imageFiles: ImageFileInfo[] = [];
    private folderExpanded: Map<string, boolean> = new Map();
    private lang: string;

    constructor(
        app: App,
        imagesFolder: string,
        selectedPaths: string[],
        onSave: (paths: string[]) => void
    ) {
        super(app);
        this.imagesFolder = imagesFolder;
        this.selectedPaths = new Set(selectedPaths);
        this.onSave = onSave;
        this.lang = (app.vault as any).getConfig?.("interfaceLanguage") || "en";
    }

    private t(key: string): string {
        return TEXTS[this.lang]?.[key] || TEXTS.en[key] || key;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("image-select-modal");

        this.titleEl.setText(this.t("selectImages"));

        this.collectImages();

        const container = contentEl.createDiv({ cls: "image-select-container" });

        if (this.imageFiles.length === 0) {
            container.createDiv({ text: this.t("empty"), cls: "image-select-empty" });
        } else {
            const grouped = this.groupByFolder();
            for (const [folderPath, files] of grouped.entries()) {
                this.renderFolder(container, folderPath, files);
            }
        }

        const footer = contentEl.createDiv({ cls: "image-select-footer" });

        const saveBtn = footer.createEl("button", { text: this.t("save"), cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            this.onSave(Array.from(this.selectedPaths));
            this.close();
        });

        const cancelBtn = footer.createEl("button", { text: this.t("cancel") });
        cancelBtn.addEventListener("click", () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }

    private collectImages() {
        const folder = this.app.vault.getAbstractFileByPath(this.imagesFolder);
        if (!(folder instanceof TFolder)) return;

        const walk = (f: TFolder) => {
            for (const child of f.children) {
                if (child instanceof TFolder) {
                    walk(child);
                } else if (child instanceof TFile && this.isImage(child.extension)) {
                    this.imageFiles.push({
                        path: child.path,
                        name: child.name,
                        folder: child.parent?.path || this.imagesFolder,
                        resourcePath: this.app.vault.getResourcePath(child),
                    });
                }
            }
        };

        walk(folder);

        this.imageFiles.sort((a, b) => {
            if (a.folder !== b.folder) return a.folder.localeCompare(b.folder);
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        });
    }

    private isImage(ext: string): boolean {
        return ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext.toLowerCase());
    }

    private groupByFolder(): Map<string, ImageFileInfo[]> {
        const map = new Map<string, ImageFileInfo[]>();
        for (const file of this.imageFiles) {
            const list = map.get(file.folder) || [];
            list.push(file);
            map.set(file.folder, list);
        }
        return map;
    }

    private renderFolder(container: HTMLElement, folderPath: string, files: ImageFileInfo[]) {
        const folderEl = container.createDiv({ cls: "image-select-folder" });

        const header = folderEl.createDiv({ cls: "folder-header" });
        const folderCheckbox = header.createEl("input", { type: "checkbox" });
        folderCheckbox.style.margin = "0";

        const folderName = folderPath === this.imagesFolder
            ? "Root"
            : folderPath.replace(this.imagesFolder, "").replace(/^[\\/]/, "");
        header.createSpan({ text: `📁 ${folderName}` });

        const isFullySelected = files.every(f => this.selectedPaths.has(f.path));
        const isPartiallySelected = files.some(f => this.selectedPaths.has(f.path));
        folderCheckbox.checked = isFullySelected;
        (folderCheckbox as HTMLInputElement).indeterminate = !isFullySelected && isPartiallySelected;

        const expanded = this.folderExpanded.get(folderPath) ?? true;
        const contentEl = folderEl.createDiv({ cls: "folder-content" });
        if (!expanded) contentEl.style.display = "none";

        header.addEventListener("click", (e) => {
            if (e.target === folderCheckbox) return;
            const newExpanded = contentEl.style.display === "none";
            contentEl.style.display = newExpanded ? "block" : "none";
            this.folderExpanded.set(folderPath, newExpanded);
        });

        folderCheckbox.addEventListener("change", () => {
            const checked = folderCheckbox.checked;
            for (const file of files) {
                if (checked) this.selectedPaths.add(file.path);
                else this.selectedPaths.delete(file.path);
            }
            this.updateFileCheckboxes(contentEl, files);
        });

        for (const file of files) {
            this.renderFile(contentEl, file);
        }
    }

    private renderFile(container: HTMLElement, file: ImageFileInfo) {
        const item = container.createDiv({ cls: "image-item" });
        const checkbox = item.createEl("input", { type: "checkbox" });
        checkbox.checked = this.selectedPaths.has(file.path);
        checkbox.style.margin = "0";

        const img = item.createEl("img");
        img.src = file.resourcePath;
        img.alt = file.name;

        item.createSpan({ text: file.name });

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) this.selectedPaths.add(file.path);
            else this.selectedPaths.delete(file.path);
        });
    }

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