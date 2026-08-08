import { App, Modal, Setting } from "obsidian";
import MangaReaderPlugin from "src/main";
import { getTranslation } from "src/i18n";

export class ReaderSettingsModal extends Modal {
    plugin: MangaReaderPlugin;

    constructor(app: App, plugin: MangaReaderPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        const t = getTranslation(this.plugin.data.settings.language);
        
        contentEl.empty();
        
        // Заголовок
        contentEl.createEl('h3', { text: t.reader.headerName });

        // Режим чтения
        new Setting(contentEl)
            .setName(t.settings.viewMode)
            .addDropdown(dropdown => dropdown
                .addOption('scroll', t.settings.scroll)
                .addOption('single', t.settings.singlePage)
                .setValue(this.plugin.data.settings.viewMode)
                .onChange(async (value) => {
                    this.plugin.data.settings.viewMode = value as 'scroll' | 'single';
                    await this.plugin.saveSettings();
                })
            );

        // Предзагрузка глав
        new Setting(contentEl)
            .setName(t.settings.indexWarmer)
            .setDesc(t.settings.indexWarmerDescription)
            .addDropdown(dropdown => dropdown
                .addOption('adjacent', t.settings.adjacent)
                .addOption('extended', t.settings.extended)
                .setValue(this.plugin.data.settings.indexWarmerMode)
                .onChange(async (value) => {
                    this.plugin.data.settings.indexWarmerMode = value as 'adjacent' | 'extended';
                    await this.plugin.saveSettings();
                })
            );

        // Фоновая индексация (Toggle)
        new Setting(contentEl)
            .setName(t.settings.backgroundIndexing)
            .setDesc(t.settings.backgroundIndexingDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.data.settings.readerBackgroundIndexing)
                .onChange(async (value) => {
                    this.plugin.data.settings.readerBackgroundIndexing = value;
                    await this.plugin.saveSettings();
                })
            );

        // Отступ между страницами (Slider)
        const pageGapSetting = new Setting(contentEl)
            .setName(t.settings.gapBetweenPage)
            .setDesc(`${this.plugin.data.settings.pageGap}px`);

        pageGapSetting.addSlider(slider => {
            slider
                .setLimits(0, 15, 1)
                .setValue(this.plugin.data.settings.pageGap)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    // Этот onChange срабатывает только после отпускания
                    this.plugin.data.settings.pageGap = value;
                    pageGapSetting.descEl.setText(`${value}px`);
                    await this.plugin.saveSettings();
                });

            // Добавляем слушатель на input событие для мгновенного обновления
            slider.sliderEl.addEventListener('input', async (e) => {
                const value = Number((e.target as HTMLInputElement).value);
                this.plugin.data.settings.pageGap = value;
                pageGapSetting.descEl.setText(`${value}px`);
                await this.plugin.saveSettings();
            });
        });

        // Ширина читалки (Slider)
        const readerWidthSetting = new Setting(contentEl)
            .setName(t.settings.readerWidth)
            .setDesc(`${this.plugin.data.settings.readerWidthPercent}%`);

        readerWidthSetting.addSlider(slider => {
            slider
                .setLimits(50, 100, 1)
                .setValue(this.plugin.data.settings.readerWidthPercent)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    // Этот onChange срабатывает только после отпускания
                    this.plugin.data.settings.readerWidthPercent = value;
                    readerWidthSetting.descEl.setText(`${value}%`);
                    await this.plugin.saveSettings();
                });

            // Добавляем слушатель на input событие для мгновенного обновления
            slider.sliderEl.addEventListener('input', async (e) => {
                const value = Number((e.target as HTMLInputElement).value);
                this.plugin.data.settings.readerWidthPercent = value;
                readerWidthSetting.descEl.setText(`${value}%`);
                await this.plugin.saveSettings();
            });
        });

        // Футер с кнопкой закрытия, со своим кастомным стилем
        const footerEl = contentEl.createDiv({ cls: 'modal-footer' });
        const closeButton = footerEl.createEl('button', {
            text: t.common.close,
            cls: 'mod-cta'
        });
        closeButton.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}