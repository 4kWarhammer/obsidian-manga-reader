import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting, Notice } from 'obsidian';
import { MangaView, VIEW_TYPE_MANGA } from './MangaView';
import { PluginData, DEFAULT_DATA } from './types';

export default class MangaReaderPlugin extends Plugin {
    data: PluginData;

    async onload() {
        // 1. Загружаем данные из файла data.json (если его нет, берем дефолты)
        this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());

        // 2. Регистрируем тип нашего окна (View)
        this.registerView(
            VIEW_TYPE_MANGA,
            (leaf) => new MangaView(leaf, this)
        );

        // 3. Добавляем иконку на левую панель
        this.addRibbonIcon('book-open', 'Manga Reader', () => {
            this.activateView();
        });

        // 4. Регистрируем вкладку настроек
        this.addSettingTab(new MangaReaderSettingTab(this.app, this));

        console.log('Плагин читалки манги загружен!');
    }

    async onunload() {
        console.log('Плагин читалки манги выгружен');
    }

    // Метод для сохранения (будем вызывать его из React)
    async savePluginData() {
        await this.saveData(this.data);
        // Вызываем событие обновления во всем плагине (чтобы увидел React)
        // Ответная ячасть находится в MangaInterface
        this.app.workspace.trigger("manga-reader:settings-update");
    }

    // Логика открытия нашего окна
    async activateView() {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_MANGA);

        if (leaves.length > 0) {
            // Если окно уже открыто — просто переключаемся на него
            leaf = leaves[0];
        } else {
            // Если нет — создаем новую вкладку в правой части (main workspace)
            leaf = workspace.getLeaf(true);
            await leaf.setViewState({
                type: VIEW_TYPE_MANGA,
                active: true,
            });
        }
        // Делаем вкладку активной
        workspace.revealLeaf(leaf);
    }
}

class MangaReaderSettingTab extends PluginSettingTab{
    plugin: MangaReaderPlugin

    constructor(app:any, plugin: MangaReaderPlugin) {
        super(app, plugin);
        this.plugin = plugin

    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Заголовок настроек
        containerEl.createEl('h2', { text: 'Manga Reader Settings' });

        // Настройка языка
        new Setting(containerEl)
            .setName('Language / Язык')
            .setDesc('Выберите язык интерфейса плагина')
            .addDropdown(dropdown => dropdown
                .addOption('ru', 'Русский')
                .addOption('en', 'English')
                .setValue(this.plugin.data.settings.language)
                .onChange(async (value: "ru" | "en") => {
                    this.plugin.data.settings.language = value;
                    await this.plugin.savePluginData();
                    // Сообщение пользователю (опционально)
                    new Notice("Language changed! / Язык изменен!");
                })
            );
        
        // ... тут могут быть другие настройки, например viewMode
    }
}