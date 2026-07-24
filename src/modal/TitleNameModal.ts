import { App, Modal } from "obsidian";

const TEXTS: Record<string, Record<string, string>> = {
    ru: {
        modalTitle: "Название тайтла",
        save: "Сохранить",
        cancel: "Отмена",
    },
    en: {
        modalTitle: "Title name",
        save: "Save",
        cancel: "Cancel",
    },
};

export class TitleNameModal extends Modal {
    private initialName: string;
    private onSave: (newName: string) => void;
    private lang: string;

    constructor(
        app: App,
        initialName: string,
        onSave: (newName: string) => void
    ) {
        super(app);
        this.initialName = initialName;
        this.onSave = onSave;
        this.lang = (app.vault as any).getConfig?.("interfaceLanguage") || "en";
    }

    private t(key: string): string {
        return TEXTS[this.lang]?.[key] || TEXTS.en[key] || key;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        this.titleEl.setText(this.t("modalTitle"));

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

        const cancelBtn = footer.createEl("button", { text: this.t("cancel") });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footer.createEl("button", { text: this.t("save"), cls: "mod-cta" });
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