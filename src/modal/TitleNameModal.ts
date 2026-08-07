import { App, Modal } from "obsidian";
import { getTranslation } from "../i18n";
import type { Language, Translation } from "../i18n";

export class TitleNameModal extends Modal {
    private initialName: string;
    private onSave: (newName: string) => void;
    private t: Translation;

    constructor(
        app: App,
        initialName: string,
        onSave: (newName: string) => void,
        language: Language
    ) {
        super(app);
        this.initialName = initialName;
        this.onSave = onSave;
        this.t = getTranslation(language);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText(this.t.modal.titleName);

        const container = contentEl.createDiv({ cls: "title-name-modal-container" });

        const input = container.createEl("input", {
            type: "text",
            value: this.initialName,
            cls: "title-name-input",
        });
        input.style.width = "100%";
        input.style.marginBottom = "1rem";

        const footer = contentEl.createDiv({ cls: "title-name-modal-footer" });
        footer.style.display = "flex";
        footer.style.justifyContent = "flex-end";
        footer.style.gap = "0.5rem";

        const cancelBtn = footer.createEl("button", { text: this.t.common.cancel });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footer.createEl("button", { text: this.t.common.save, cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            this.onSave(input.value);
            this.close();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();   // блокируем встроенное поведение Obsidian
                saveBtn.click();      // триггерим единый обработчик кнопки
            }
        });

        // Автофокус на поле ввода
        setTimeout(() => input.focus(), 0);
    }

    onClose() {
        this.contentEl.empty();
    }
}