import { Plugin, WorkspaceLeaf } from 'obsidian';
import { MangaView, VIEW_TYPE_MANGA } from './MangaView';

export default class MangaReaderPlugin extends Plugin {
    async onload() {
        // 1. Регистрируем тип нашего окна (View)
        this.registerView(
            VIEW_TYPE_MANGA,
            (leaf) => new MangaView(leaf)
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