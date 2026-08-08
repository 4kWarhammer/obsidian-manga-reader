import React from 'react';
import { Plugin, WorkspaceLeaf, PluginSettingTab, Setting, Notice, normalizePath } from 'obsidian';
import { MangaView, VIEW_TYPE_MANGA } from './MangaView';
import { PluginData, DEFAULT_DATA } from './types';
import { ChapterIndexManager } from './utils/ChapterIndexManager';
import { ChapterIndexCache } from './utils/ChapterIndexCache';
import { ObsidianCacheStorageAdapter } from './utils/ObsidianCacheStorageAdapter';
import { MangaReaderSettingTab } from './settings/MangaReaderSettingTab';
import { getTranslation } from "./i18n";
import type { Language, Translation } from "./i18n";

// Только для development
if (process.env.NODE_ENV !== 'production') {
    import('@welldone-software/why-did-you-render').then((module) => {
        module.default(React, {
            trackAllPureComponents: true,
            logOnDifferentValues: true,
            include: [/Manga/, /Chapter/, /Reader/],
        });
    });
}

export default class MangaReaderPlugin extends Plugin {
    data: PluginData = DEFAULT_DATA;

    // Для правильного восстановления при запуске Obsidian
    isRestoringLayout = true;

    private chapterIndexManager: ChapterIndexManager | null = null;

    async onload() {
        const loaded = (await this.loadData()) || {};
        // Сверяем и дополняем из data.json (если его нет, берем дефолты)
        this.data = {
            ...DEFAULT_DATA,
            ...loaded,
            settings: {
                ...DEFAULT_DATA.settings,
                ...(loaded.settings || {}),
            },
        };

        // Создаем системные папки если их нет
        const systemFolders = [
            normalizePath(this.data.settings.notesFolder),
            normalizePath(this.data.settings.imagesFolder),
        ];
        // Делаем проверку через адаптер, не через getAbstractFileByPath
        // Иначе при старте системы выдаст null (индексация еще не закончилась)
        // И попробуем создать уже имеющуюся папку
        // У меня же еще есть ObsidianCacheStorageAdapter...
        for (const folderPath of systemFolders) {
            const exists = await this.app.vault.adapter.exists(folderPath);
            if (!exists) {
                try {
                    await this.app.vault.createFolder(folderPath);
                } catch (err: any) {
                    // Игнорируем, если папка всё-таки уже есть (например, создана параллельно)
                    if (!err?.message?.toLowerCase().includes("already exists")) {
                        throw err;
                    }
                }
            }
        }

        // Регистрируем тип нашего окна (View)
        this.registerView(
            VIEW_TYPE_MANGA,
            (leaf) => new MangaView(leaf, this)
        );

        // Выполняется когда Layout будет готов, снимет флаг и навигация снова заработает
        this.app.workspace.onLayoutReady(() => {
            this.isRestoringLayout = false;
        });

        // Добавляем иконку на левую панель
        this.addRibbonIcon('book-open', 'Manga Reader', () => {
            this.activateView();
        });

        // Регистрируем вкладку настроек
        this.addSettingTab(new MangaReaderSettingTab(this.app, this));

        console.log('Плагин читалки манги загружен!');
    }

    async onunload() {
        // Сохраняем при закрытии плагина
        await this.chapterIndexManager?.save();
        console.log('Плагин читалки манги выгружен');
    }

    // Методы для сохранения
    // Сохранение настроек, требует ре-рендера компонентов, поэтому с уведомлением
    async saveSettings() {
        await this.saveData(this.data);

        // Вызываем событие обновления во всем плагине (чтобы увидел React)
        // Ответная ячасть находится в MangaInterface
        this.app.workspace.trigger("manga-reader:settings-update");
    }

    // Сохранение только прогресса (страница, глава) — без события
    async saveProgress() {
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

    // Создаем единственный экземпляр ChapterIndexManager
    // Будет использоваться как singleton для всего плагина
    getChapterIndexManager(): ChapterIndexManager {
        if (!this.chapterIndexManager) {
            const cachePath = normalizePath(
                `${this.manifest.dir}/image-index-cache.json`
            );

            const storageAdapter = new ObsidianCacheStorageAdapter(
                this.app.vault.adapter
            );

            const cache = new ChapterIndexCache(cachePath, storageAdapter);

            this.chapterIndexManager = new ChapterIndexManager(cache);
        }

        return this.chapterIndexManager;
    }
}
