import { App, Modal } from "obsidian";

const TEXTS: Record<string, Record<string, string>> = {
    ru: {
        modalTitle: "Выставить рейтинг",
        save: "Сохранить",
        cancel: "Отмена",
    },
    en: {
        modalTitle: "Rate this title",
        save: "Save",
        cancel: "Cancel",
    },
};

export class RatingModal extends Modal {
    private initialRating: number;
    private onSave: (rating: number) => void;
    private lang: string;

    constructor(
        app: App,
        initialRating: number | null | undefined,
        onSave: (rating: number) => void
    ) {
        super(app);
        this.initialRating = initialRating ?? 0;
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

        const container = contentEl.createDiv({ cls: "rating-modal-container" });

        // Крупное число текущего значения
        const valueDisplay = container.createEl("div", {
            cls: "rating-modal-value",
            text: this.initialRating.toFixed(1),
        });

        // Ползунок 0…10, шаг 0.1
        const slider = container.createEl("input", {
            type: "range",
            cls: "rating-modal-slider",
        });
        slider.min = "0";
        slider.max = "10";
        slider.step = "0.1";
        slider.value = String(this.initialRating);

        // Числовое поле для ручного ввода
        const numInput = container.createEl("input", {
            type: "number",
            cls: "rating-modal-number",
        });
        numInput.min = "0";
        numInput.max = "10";
        numInput.step = "0.1";
        numInput.value = this.initialRating.toFixed(1);

        // Ползунок -> поле и отображение
        slider.addEventListener("input", () => {
            const val = parseFloat(slider.value);
            const clamped = Math.max(0, Math.min(10, val));
            numInput.value = clamped.toFixed(1);
            valueDisplay.setText(clamped.toFixed(1));
        });

        // Поле -> ползунок и отображение
        numInput.addEventListener("input", () => {
            const raw = numInput.value.trim().replace(",", ".");
            const val = parseFloat(raw);
            if (isNaN(val)) {
                valueDisplay.setText("—");
                return;
            }
            const clamped = Math.max(0, Math.min(10, val));
            slider.value = String(clamped);
            valueDisplay.setText(clamped.toFixed(1));
        });

        // При потере фокуса/ENTER/normalize некорректного ввода
        numInput.addEventListener("change", () => {
            const raw = numInput.value.trim().replace(",", ".");
            let val = parseFloat(raw);
            if (isNaN(val)) val = this.initialRating;
            val = Math.max(0, Math.min(10, val));
            slider.value = String(val);
            numInput.value = val.toFixed(1);
            valueDisplay.setText(val.toFixed(1));
        });

        // Футер
        const footer = contentEl.createDiv({ cls: "rating-modal-footer" });

        const cancelBtn = footer.createEl("button", { text: this.t("cancel") });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footer.createEl("button", { text: this.t("save"), cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            const raw = numInput.value.trim().replace(",", ".");
            const val = parseFloat(raw);
            const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(10, val));
            this.onSave(clamped);
            this.close();
        });

        // Enter в числовом поле тоже сохраняет
        numInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                saveBtn.click();
            }
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}