// Что делает этот класс:
// Загружает/сохраняет кэши изображений для каждого тайтла отдельно
// Каждый тайтл хранится в отдельном JSON файле в папке cache/
// Lazy loading: файлы загружаются только при обращении к главам конкретного тайтла

import {
    ImageIndexCacheFile,
    CachedChapterIndex,
    ChapterSignature,
    CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
    CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
} from 'src/types';
import { CacheStorageAdapter } from './indexTypes';
import { normalizePath } from 'obsidian';


// Структура для хранения кэша одного тайтла в памяти
interface TitleCache {
    data: ImageIndexCacheFile;
    dirty: boolean;
}

export class ChapterIndexCache {

    // Базовый путь к папке с кэшами (например: .obsidian/plugins/manga-reader/cache/)
    private baseCachePath: string;

    // Map загруженных в память кэшей тайтлов
    // titleKey -> TitleCache
    private loadedTitles = new Map<string, TitleCache>();

    // Map промисов загрузки для предотвращения дублирования
    private loadingPromises = new Map<string, Promise<TitleCache>>();

    // Адаптер для работы с файловой системой
    private adapter: CacheStorageAdapter;

    constructor(baseCachePath: string, adapter: CacheStorageAdapter) {
        this.baseCachePath = baseCachePath;
        this.adapter = adapter;
    }

    // ============================================================
    // Загрузка и сохранение в персистентные метаданные
    // ============================================================

    /**
     * Метод load() больше не нужен с архитектурой lazy loading.
     * Каждый тайтл загружается автоматически при первом обращении.
     * Метод удален.
     */

    /**
     * Сохраняет все измененные (dirty) тайтлы на диск
     */
    async save(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) {
            throw new Error('ChapterIndexCache: save aborted');
        }

        const savePromises: Promise<void>[] = [];

        for (const [titleKey, titleCache] of this.loadedTitles) {
            if (titleCache.dirty) {
                savePromises.push(this.saveTitleCache(titleKey, titleCache));
            }
        }

        await Promise.all(savePromises);
    }

    /**
     * Сохраняет кэш конкретного тайтла
     */
    private async saveTitleCache(titleKey: string, titleCache: TitleCache): Promise<void> {
        try {
            titleCache.data.updatedAt = Date.now();
            const content = JSON.stringify(titleCache.data, null, 2);
            const filePath = this.getTitleCacheFilePath(titleKey);
            
            await this.adapter.write(filePath, content);
            titleCache.dirty = false;
        } catch (err) {
            console.error(`ChapterIndexCache: failed to save cache for title "${titleKey}"`, err);
            // Не бросаем ошибку дальше — кэш не критичен для работы ридера
        }
    }

    // ============================================================
    // Чтение / запись / инвалидация записей
    // ============================================================

    /**
     * Получить закэшированный индекс главы (асинхронно)
     */
    async getChapter(chapterKey: string): Promise<CachedChapterIndex | undefined> {
        const titleKey = this.extractTitleKeyFromChapterKey(chapterKey);
        const titleCache = await this.ensureTitleLoaded(titleKey);
        
        return titleCache.data.chapters[chapterKey];
    }

    /**
     * Сохранить индекс главы в кэш
     */
    async setChapter(index: CachedChapterIndex): Promise<void> {
        const titleKey = index.titleKey;
        const titleCache = await this.ensureTitleLoaded(titleKey);
        
        titleCache.data.chapters[index.chapterKey] = index;
        titleCache.dirty = true;
    }

    /**
     * Инвалидировать (удалить) индекс главы из кэша
     */
    async invalidateChapter(chapterKey: string): Promise<void> {
        const titleKey = this.extractTitleKeyFromChapterKey(chapterKey);
        
        // Проверяем, загружен ли тайтл
        if (!this.loadedTitles.has(titleKey) && !this.loadingPromises.has(titleKey)) {
            return; // Тайтл даже не загружен — нечего инвалидировать
        }

        const titleCache = await this.ensureTitleLoaded(titleKey);
        delete titleCache.data.chapters[chapterKey];
        titleCache.dirty = true;
    }

    /**
     * Проверка валидности кэша главы (асинхронно)
     */
    async hasValidChapter(chapterKey: string, signature: ChapterSignature): Promise<boolean> {
        const entry = await this.getChapter(chapterKey);
        if (!entry) return false;

        // 1. Проверяем версии
        if (entry.schemaVersion !== CURRENT_IMAGE_INDEX_SCHEMA_VERSION) {
            return false;
        }
        if (entry.extractorVersion !== CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION) {
            return false;
        }

        // 2. Проверяем kind
        if (entry.signature.kind !== signature.kind) {
            return false;
        }

        // 3. Проверяем сигнатуру
        if (entry.signature.kind === 'archive' && signature.kind === 'archive') {
            return (
                entry.signature.path === signature.path &&
                entry.signature.size === signature.size
            );
        }

        if (entry.signature.kind === 'folder' && signature.kind === 'folder') {
            return (
                entry.signature.path === signature.path &&
                entry.signature.fileCount === signature.fileCount &&
                entry.signature.filesHash === signature.filesHash
            );
        }

        return false;
    }

    /**
     * Получить список всех ключей глав из всех загруженных тайтлов
     */
    getAllChapterKeys(): string[] {
        const keys: string[] = [];
        
        for (const titleCache of this.loadedTitles.values()) {
            keys.push(...Object.keys(titleCache.data.chapters));
        }
        
        return keys;
    }

    // ============================================================
    // Утилиты
    // ============================================================

    isDirty(): boolean {
        for (const titleCache of this.loadedTitles.values()) {
            if (titleCache.dirty) return true;
        }
        return false;
    }

    getCacheSnapshot(): ImageIndexCacheFile | null {
        // Для совместимости оставляем метод, но он теперь менее актуален
        // Возвращаем null, так как единого кэша больше нет
        console.warn('ChapterIndexCache: getCacheSnapshot() is deprecated with multi-file cache');
        return null;
    }

    // ============================================================
    // Внутренние методы
    // ============================================================

    /**
     * Загружает кэш тайтла в память, если он еще не загружен
     * Асинхронный метод — ожидает загрузки с диска при первом обращении
     */
    private async ensureTitleLoaded(titleKey: string): Promise<TitleCache> {
        // Если уже загружен — возвращаем из памяти
        if (this.loadedTitles.has(titleKey)) {
            return this.loadedTitles.get(titleKey)!;
        }

        // Если уже идет загрузка — ждем её завершения
        const existingPromise = this.loadingPromises.get(titleKey);
        if (existingPromise) {
            return await existingPromise;
        }

        // Создаем промис загрузки
        const loadPromise = this.loadTitleCacheFromDisk(titleKey);
        this.loadingPromises.set(titleKey, loadPromise);

        try {
            const titleCache = await loadPromise;
            return titleCache;
        } finally {
            // Удаляем промис после завершения загрузки
            this.loadingPromises.delete(titleKey);
        }
    }

    /**
     * Загружает кэш тайтла с диска
     */
    private async loadTitleCacheFromDisk(titleKey: string): Promise<TitleCache> {
        // Создаем структуру заранее
        const titleCache: TitleCache = {
            data: createEmptyCache(),
            dirty: false,
        };

        // Сохраняем в Map СРАЗУ, до загрузки с диска
        // Это предотвращает повторные загрузки одного тайтла
        this.loadedTitles.set(titleKey, titleCache);

        try {
            const filePath = this.getTitleCacheFilePath(titleKey);
            const exists = await this.adapter.exists(filePath);
            
            if (!exists) {
                // Файл не существует — используем пустой кэш
                return titleCache;
            }

            const content = await this.adapter.read(filePath);

            if (!content.trim()) {
                console.warn(`ChapterIndexCache: empty cache file for title "${titleKey}"`);
                return titleCache;
            }

            const parsed = JSON.parse(content) as ImageIndexCacheFile;

            // Базовая валидация структуры
            if (
                !parsed ||
                typeof parsed !== 'object' ||
                typeof parsed.schemaVersion !== 'number' ||
                typeof parsed.extractorVersion !== 'number' ||
                typeof parsed.chapters !== 'object'
            ) {
                console.warn(`ChapterIndexCache: malformed cache file for title "${titleKey}"`);
                return titleCache;
            }

            // Загружаем данные из файла В УЖЕ СОХРАНЕННЫЙ объект
            titleCache.data = parsed;
            titleCache.dirty = false;
        } catch (err) {
            console.warn(`ChapterIndexCache: failed to load cache for title "${titleKey}"`, err);
            // Используем пустой кэш при ошибке
        }

        return titleCache;
    }

    /**
     * Генерирует путь к файлу кэша для конкретного тайтла
     */
    private getTitleCacheFilePath(titleKey: string): string {
        // Преобразуем titleKey в безопасное имя файла
        // Заменяем символы, которые нельзя использовать в именах файлов
        const safeName = titleKey
            .replace(/[:\\\/\*\?"<>\|]/g, '_')
            .replace(/\s+/g, '_');
        
        return normalizePath(`${this.baseCachePath}/${safeName}.json`);
    }

    /**
     * Извлекает titleKey из chapterKey
     * 
     * chapterKey имеет формат: `{parentPath}::{chapterName}`
     * titleKey обычно равен parentPath
     */
    private extractTitleKeyFromChapterKey(chapterKey: string): string {
        const separatorIndex = chapterKey.indexOf('::');
        
        if (separatorIndex === -1) {
            // Неожиданный формат — возвращаем сам ключ
            console.warn(`ChapterIndexCache: unexpected chapterKey format: "${chapterKey}"`);
            return chapterKey;
        }
        
        return chapterKey.substring(0, separatorIndex);
    }
}

// ============================================================
// Хелперы
// ============================================================

function createEmptyCache(): ImageIndexCacheFile {
    return {
        schemaVersion: CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
        extractorVersion: CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
        updatedAt: Date.now(),
        chapters: {},
    };
}