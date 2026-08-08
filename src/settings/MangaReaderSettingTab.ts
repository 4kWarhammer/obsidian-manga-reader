import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import MangaReaderPlugin from '../main';
import { FolderSelectModal } from '../modal/FolderSelectModal';
import { getTranslation } from '../i18n';
import { uptime } from 'node:process';

export class MangaReaderSettingTab extends PluginSettingTab {
    plugin: MangaReaderPlugin;

    constructor(app: App, plugin: MangaReaderPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        // Не знаю как, но это сработало - добавился где то невидимый класс
        // И теперь настройки можно задавать своим классом
        containerEl.addClass('manga-reader-settings')

        const t = getTranslation(this.plugin.data.settings.language);

        // Заголовок настроек
        containerEl.createEl('h3', { 
            text: t.settings.settingsTitle,
            cls: 'manga-settings-header-h3' 
        });

        // Настройка языка
        new Setting(containerEl)
            .setName(t.settings.language)            
            .setDesc(t.settings.lanDescription)
            .addDropdown(dropdown => dropdown
                .addOption('ru', 'Русский')
                .addOption('en', 'English')
                .setValue(this.plugin.data.settings.language)
                .onChange(async (value) => {
                    this.plugin.data.settings.language = value as 'ru' | 'en';
                    await this.plugin.saveSettings();
                    this.display(); // Перерисовываем с новым языком
                    const newT = getTranslation(value);
                    new Notice(newT.settings.languageNotice);
                })
            );

        // Управление источниками ===
        containerEl.createEl('h3', { 
            text: t.settings.sourcesTitle,
            cls: 'manga-settings-header-h3'
        });

        // Настройка папки по умолчанию (Vault)
        new Setting(containerEl)
            .setName(t.settings.defaultPath)
            .setDesc(this.plugin.data.defaultLibraryPath 
                ? `${t.settings.currentDefaultPath} ${this.plugin.data.defaultLibraryPath}` 
                : t.settings.noCurrent)
            .addButton(button => button
                .setButtonText(t.settings.selectDefaultFolder)
                .onClick(() => {
                    new FolderSelectModal(
                        this.app, 
                        this.plugin, 
                        async (path: string) => {
                            this.plugin.data.defaultLibraryPath = path;
                            await this.plugin.saveSettings();
                            this.display(); // Перерисовываем настройки, чтобы показать новый путь
                            new Notice(`${t.settings.defaultFolderNotice} ${path}`);
                        }, 
                        "vault"
                    ).open();
                })
            );

        // Настройка внешних источников (только для Desktop)
        if ((window as any).require) {
            const externalSourcesDesc = this.plugin.data.externalSources.length > 0
                ? `${t.settings.currentExternalPath} ${this.plugin.data.externalSources.length}`
                : t.settings.noExternalPath;

            new Setting(containerEl)
                .setName(t.settings.externalPath)
                .setDesc(externalSourcesDesc)
                .addButton(button => button
                    .setButtonText(t.settings.selectExternalFolder)
                    .onClick(() => {
                        new FolderSelectModal(
                            this.app, 
                            this.plugin, 
                            async (path: string) => {
                                if (!this.plugin.data.externalSources.includes(path)) {
                                    this.plugin.data.externalSources.push(path);
                                    await this.plugin.saveSettings();
                                    this.display(); // Перерисовываем настройки
                                    // new Notice(`External source added: ${path}`);
                                } else {
                                    new Notice(t.settings.alreadyHas);
                                }
                            }, 
                            "external"
                        ).open();
                    })
                );

            // Опционально: кнопка для удаления внешних источников
            if (this.plugin.data.externalSources.length > 0) {
                let selectedSourceToRemove = this.plugin.data.externalSources[0]; // По умолчанию первый
                
                new Setting(containerEl)
                    .setName(t.settings.remove)
                    .setDesc(t.settings.selectRemove)
                    .addDropdown(dropdown => {
                        this.plugin.data.externalSources.forEach(source => {
                            dropdown.addOption(source, source);
                        });
                        dropdown.setValue(selectedSourceToRemove);
                        dropdown.onChange((value) => {
                            selectedSourceToRemove = value;
                        });
                        return dropdown;
                    })
                    .addButton(button => button
                        .setButtonText(t.settings.removeButton)
                        .setWarning()
                        .onClick(async () => {
                            if (selectedSourceToRemove) {
                                this.plugin.data.externalSources = this.plugin.data.externalSources
                                    .filter(p => p !== selectedSourceToRemove);
                                await this.plugin.saveSettings();
                                this.display();
                                new Notice(`${t.settings.removeNotice} ${selectedSourceToRemove}`);
                            }
                        })
                    );
            }
        }

        containerEl.createEl('h3', { 
            text: t.settings.viewModeTitle,
            cls: 'manga-settings-header-h3'
        });

        // Выбор режима просмотра
        // Сюда бы еще типы подтянуть, чтобы не ошибится
        new Setting(containerEl)
            .setName(t.settings.viewMode)
            .setDesc(t.settings.viewModeDesc)
            .addDropdown(dropdown => dropdown
                .addOption('scroll', t.settings.scroll)
                .addOption('single', t.settings.singlePage)
                .setValue(this.plugin.data.settings.viewMode)
                .onChange(async (value) => {
                    this.plugin.data.settings.viewMode = value as 'scroll' | 'single';
                    await this.plugin.saveSettings();
                    // Тут может и не надо перерисовывать
                    // this.display();
                })
            )

        // Предзагрузка соседей
        new Setting(containerEl)
            .setName(t.settings.indexWarmer)
            .setDesc(t.settings.indexWarmerDescription)
            .addDropdown(dropdown => dropdown
                .addOption('adjacent', t.settings.adjacent)
                .addOption("extended", t.settings.extended)
                .setValue(this.plugin.data.settings.indexWarmerMode)
                .onChange(async (value) => {
                    this.plugin.data.settings.indexWarmerMode = value as 'adjacent' | 'extended';
                    await this.plugin.saveSettings();
                    // Тут может и не надо перерисовывать
                    // this.display();
                })
            )

        // Фоновая индексация
        new Setting(containerEl)
            .setName(t.settings.backgroundIndexing)
            .setDesc(t.settings.backgroundIndexingDescription)
            .addToggle((toggle) => toggle
                .setValue(this.plugin.data.settings.readerBackgroundIndexing)
                .onChange(async (value) => {
                    this.plugin.data.settings.readerBackgroundIndexing = value as true | false
                    await this.plugin.saveSettings();
                })
        )
    }
}