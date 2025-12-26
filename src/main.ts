import { Plugin, WorkspaceLeaf } from 'obsidian';
import { MangaView, VIEW_TYPE_MANGA } from './MangaView';
import { PluginData, DEFAULT_DATA } from './types';

export default class MangaReaderPlugin extends Plugin {
    data: PluginData;

    async onload() {
        // Загружаем данные из файла data.json (если его нет, берем дефолты)
        this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());


        // 1. Регистрируем тип нашего окна (View)
        this.registerView(
            VIEW_TYPE_MANGA,
            (leaf) => new MangaView(leaf, this)
        );

        // 2. Добавляем иконку на левую панель
        this.addRibbonIcon('book-open', 'Manga Reader', () => {
            this.activateView();
        });

        console.log('Плагин читалки манги загружен!');
    }

    async onunload() {
        console.log('Плагин читалки манги выгружен');
    }

    // Метод для сохранения (будем вызывать его из React)
    async savePluginData() {
        await this.saveData(this.data);
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