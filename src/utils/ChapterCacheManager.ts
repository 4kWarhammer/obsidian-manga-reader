import { App, TFolder } from "obsidian";
import { ImageCache } from "./ImageCache";
import { ImageLoader } from "./ImageLoader";

// Node.js модули
const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;

export class ChapterCacheManager {
    // Это хранилища для кэшей
    private caches = new Map<string, ImageCache>();
    private loaders = new Map<string, ImageLoader>();
    private allChapters: string[] = [];
    
    // Кэш totalPages: chapterName → number
    private totalPagesCache = new Map<string, number>();

    private parentPath: string = '';
    private isExternal: boolean = false;
    private app: App | null = null;
    private initialized: boolean = false;


    // Вот это новая концепция, но это по сути метод для
    // добавления в класс частных своих переменных.
    initialize(parentPath: string, app: App): void {
        this.parentPath = parentPath;
        this.isExternal = parentPath.includes(":\\") || parentPath.startsWith("/");
        this.app = app;
        this.initialized = true;
    }

    private checkInitialized(): void {
        if (!this.initialized) {
            throw new Error("ChapterCacheManager: Not initialized. Call initialize() first.")
        }
    }

    // Вот тут не совсем понял пока
    private currentChapter: string | null = null;

    // ===ПОЛУЧЕНИЕ КЭША===
    //Создает кэш при первом обращении
    getCache(chapterName: string): ImageCache {
        if (!this.caches.has(chapterName)) {            
            this.caches.set(chapterName, new ImageCache());
            console.log(`ChapterCacheManager: Created cache for "${chapterName}"`);
        }

        return this.caches.get(chapterName)!;
    }

    // === ПОЛУЧЕНИЕ LOADER'а ===
    getLoader(chapterName: string): ImageLoader {
        if (!this.app) {
            throw new Error("ChapterCacheManager: App is not initialized");
        }
        
        let loader = this.loaders.get(chapterName);

        if (!loader) {
            const cache = this.getCache(chapterName);
            const isArchive = chapterName.endsWith('.zip') || chapterName.endsWith('.cbz');
            loader = new ImageLoader(
                this.parentPath,
                chapterName,
                cache,
                isArchive,
                this.isExternal,
                this.app
            );

            this.loaders.set(chapterName, loader);
            console.log(`ChapterCacheManager: Created loader for "${chapterName}"`);            
        }

        return loader;
    }

    // === ЗАГРУЗКА СПИСКА ГЛАВ ===
    /**
     * Метод ChapterCacheManager
     * 
     * async, возвращает список имен глав из папки/архива
     * @returns names
     */
    async loadChaptersList(): Promise<string[]> {
        if (!this.app) {
            throw new Error("ChapterCacheManager: App is not initialized");
        }        
        this.checkInitialized();
        
        let names: string[] = [];
        
        if (this.isExternal && fs && pathModule) {
            const entries = fs.readdirSync(this.parentPath, { withFileTypes: true });
            names = entries
                .filter((e: any) => e.isDirectory() || e.name.endsWith('.zip') || e.name.endsWith('.cbz'))
                .map((e: any) => e.name)
                .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
        } else {
            const folder = this.app.vault.getAbstractFileByPath(this.parentPath);
            if (folder instanceof TFolder) {
                names = folder.children
                    .filter(f => f instanceof TFolder || f.name.endsWith('.zip') || f.name.endsWith('.cbz'))
                    .map(f => f.name)
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            }
        }
        
        // Сохраняем список глав во внутреннюю память
        this.allChapters = names;
        console.log(`ChapterCacheManager: Loaded ${names.length} chapters`);
        return names;
    }

    /**
     * Метод ChapterCacheManager
     * 
     * Возвращает список всех глав, загруженных в кэш
     * @returns allChapters
     */
    getAllChapters(): string[] {
        return this.allChapters;
    }

    /**
     * Метод ChapterCacheManager
     * 
     * Возвращает имена соседних глав (предыдущая и следующая) для данной главы
     * @param currentChapter 
     * @returns prev: string | null, next: string | null
     */
    getAdjacentChapters(currentChapter: string): { prev: string | null, next: string | null } {
        const idx = this.allChapters.indexOf(currentChapter);
        if (idx === -1) return { prev: null, next: null };
        
        return {
            prev: idx > 0 ? this.allChapters[idx - 1] : null,
            next: idx < this.allChapters.length - 1 ? this.allChapters[idx + 1] : null
        };
    }

    private async preloadAdjacentChapters(
        onImageLoaded?: (chapter: string, index: number, url: string) => void
    ): Promise<void> {
        if (!this.currentChapter || this.allChapters.length === 0) return;

        const adjacent = this.getAdjacentChapters(this.currentChapter);

        // Предзагружаем предыдущую главу
        if (adjacent.prev) {
            await this.preloadChapterEdges(adjacent.prev, onImageLoaded);
        }

        // Предзагружаем следующую главу
        if (adjacent.next) {
            await this.preloadChapterEdges(adjacent.next, onImageLoaded);
        }
    }

    private async preloadChapterEdges(
        chapter: string,
        onImageLoaded?: (chapter: string, index: number, url: string) => void
    ): Promise<void> {
        const loader = this.getLoader(chapter);
        const total = await this.getTotalPages(chapter);

        // Загружаем первые 2 и последние 2 страницы
        const edgeIndices = [0, 1, total - 2, total - 1].filter(i => i >= 0 && i < total);

        await Promise.all(
            edgeIndices.map(async idx => {
                const url = await loader.load(idx);
                // Вызываем callback после загрузки каждой страницы
                if (onImageLoaded) {
                    onImageLoaded(chapter, idx, url);
                }
            })
        );

        console.log(`[Preload] Edges for "${chapter}": [${edgeIndices.join(', ')}]`);
    }


    /**
     * Устанавливает главу в качестве текущей для ChapterCacheManager
     * 
     * async, выполняет предзагрузку краёв соседних глав с помощью preloadAdjacentChapters и callback функции onImageLoaded
     * @param chapterName - устанавливает главу в качестве текущей для ChapterCacheManager
     * @param onImageLoaded - callback функция из useLazyImageLoader, выполняет загрузку в state loadedUrls после предзагрузки краёв соседних глав
     * @returns 
     */
    // === УПРАВЛЕНИЕ ТЕКУЩЕЙ ГЛАВОЙ ===
    setCurrentChapter(
        chapterName: string,
        onImageLoaded?: (chapter: string, index: number, url: string) => void
    ): void {
        // условие если ничего не поменялось, быстрый выход
        if (this.currentChapter === chapterName) return;

        // Устанавливаем новую главу текущей
        this.currentChapter = chapterName;

        console.log(`ChapterCacheManager: Current chapter set to "${chapterName}"`);
        
        // Вызываем предзагрузку с callback для обновления loadedUrls
        this.preloadAdjacentChapters(onImageLoaded);
    }

    // === ОЧИСТКА СТАРЫХ ГЛАВ ===
    pruneOldChapters(keepChapters: string[]): void {
        for (const [chapterName, cache] of this.caches) {
            if (!keepChapters.includes(chapterName)) {
                cache.clear();
                this.caches.delete(chapterName);
                this.loaders.delete(chapterName);
                this.totalPagesCache.delete(chapterName);  // ← Очищаем кэш totalPages
                console.log(`ChapterCacheManager: Pruned chapter "${chapterName}"`);
            }
        }
    }

    // === ПОЛУЧЕНИЕ URL ===
    // Походу не нужен - поскольку синхронно вытаскиваем из кэша
    getUrl(chapterName: string, index: number): string | null {
    return this.getCache(chapterName).get(index);
    }

    // === ЗАГРУЗКА СТРАНИЦЫ ===
    /**
     * Метод ChapterCacheManager
     * async тип
     * 
     * Загружает страницу по индексу для указанной главы, используя соответствующий ImageLoader.

     * @returns loader.load(index)
     */
    async loadPage(chapterName: string, index: number): Promise<string> {
        const loader = this.loaders.get(chapterName);
        if (!loader) {
            throw new Error(`ChapterCacheManager: No loader for chapter "${chapterName}"`);
        }
        return loader.load(index);
    }

    // === ПОЛУЧЕНИЕ КОЛИЧЕСТВА СТРАНИЦ ===
    /**
     * Метод ChapterCacheManager
     *
     * Возвращает количество страниц в главе, используя соответствующий ImageLoader.
     * Кэширует результат для синхронного доступа в будущем.
     * @returns loader.getTotalPages()
     */
    async getTotalPages(chapterName: string): Promise<number> {
        // Проверяем кэш
        if (this.totalPagesCache.has(chapterName)) {
            return this.totalPagesCache.get(chapterName)!;
        }
        
        const loader = this.loaders.get(chapterName);
        if (!loader) {
            throw new Error(`ChapterCacheManager: No loader for chapter "${chapterName}"`);
        }
        
        const total = await loader.getTotalPages();
        
        // Кэшируем результат
        this.totalPagesCache.set(chapterName, total);
        console.log(`ChapterCacheManager: Cached totalPages=${total} for "${chapterName}"`);
        
        return total;
    }

    /**
     * Метод ChapterCacheManager
     *
     * Синхронно возвращает количество страниц в главе из кэша.
     * Если глава ещё не загружена, возвращает 0.
     * @returns number | 0
     */
    getTotalPagesSync(chapterName: string): number {
        return this.totalPagesCache.get(chapterName) ?? 0;
    }

    // === ВЫГРУЗКА СТРАНИЦЫ ===
    release(chapterName: string, index: number): void {
        const cache = this.caches.get(chapterName);
        if (cache) {
            cache.release(index);
        }
    }


    // === СОСТОЯНИЕ ЗАГРУЗКИ ===
    isLoading(chapterName: string, index: number, loadingSet: Set<string>): boolean {
        const key = `${chapterName}:${index}`;
        return loadingSet.has(key);
    }

    // === ПОЛНАЯ ОЧИСТКА ===
    clear(): void {
        for (const [chapterName, cache] of this.caches) {
            cache.clear();
        }
        this.caches.clear();
        this.loaders.clear();
        this.totalPagesCache.clear();  // ← Очищаем кэш totalPages
        this.currentChapter = null;
        console.log('ChapterCacheManager: Cleared all caches');
    }

        // === ИНФОРМАЦИЯ ===
    
    getCurrentChapter(): string | null {
        return this.currentChapter;
    }
    
    hasChapter(chapterName: string): boolean {
        return this.caches.has(chapterName);
    }
}