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
     * Загрузка больше не нужна при старте — используется lazy loading
     */
    async load(signal?: AbortSignal): Promise<void> {
        // Оставляем метод для совместимости с ChapterIndexManager
        // Фактически ничего не делаем — загрузка произойдет при первом обращении
        if (signal?.aborted) {
            throw new Error('ChapterIndexCache: load aborted');
        }
    }

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
     * Получить закэшированный индекс главы
     */
    getChapter(chapterKey: string): CachedChapterIndex | undefined {
        const titleKey = this.extractTitleKeyFromChapterKey(chapterKey);
        const titleCache = this.ensureTitleLoaded(titleKey);
        
        return titleCache.data.chapters[chapterKey];
    }

    /**
     * Сохранить индекс главы в кэш
     */
    setChapter(index: CachedChapterIndex): void {
        const titleKey = index.titleKey;
        const titleCache = this.ensureTitleLoaded(titleKey);
        
        titleCache.data.chapters[index.chapterKey] = index;
        titleCache.dirty = true;
    }

    /**
     * Инвалидировать (удалить) индекс главы из кэша
     */
    invalidateChapter(chapterKey: string): void {
        const titleKey = this.extractTitleKeyFromChapterKey(chapterKey);
        
        if (!this.loadedTitles.has(titleKey)) {
            return; // Тайтл даже не загружен — нечего инвалидировать
        }

        const titleCache = this.loadedTitles.get(titleKey)!;
        delete titleCache.data.chapters[chapterKey];
        titleCache.dirty = true;
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
    // Валидация
    // ============================================================

    hasValidChapter(chapterKey: string, signature: ChapterSignature): boolean {
        const entry = this.getChapter(chapterKey);
        if (!entry) return false;

        // 1. Проверяем версии
        if (entry.schemaVersion !== CURRENT_IMAGE_INDEX_SCHEMA_VERSION) {
            return false;
        }
        if (entry.extractorVersion !== CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION) {
            return false;
        }

        // 2. Проверяем kind у кого с кем?
        if (entry.signature.kind !== signature.kind) {
            return false;
        }

        // 3. Проверяем сигнатуру
        if (entry.signature.kind === 'archive' && signature.kind === 'archive') {
            return (
                entry.signature.path === signature.path &&
                entry.signature.size === signature.size
                // entry.signature.mtime === signature.mtime
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
     * Синхронный метод — загрузка происходит синхронно при первом обращении
     */
    private ensureTitleLoaded(titleKey: string): TitleCache {
        if (this.loadedTitles.has(titleKey)) {
            return this.loadedTitles.get(titleKey)!;
        }

        // Создаем новый пустой кэш для тайтла
        // Фактическая загрузка с диска будет выполнена асинхронно при первом save/load
        const titleCache: TitleCache = {
            data: createEmptyCache(),
            dirty: false,
        };

        // Пытаемся загрузить с диска (без await — загрузка в фоне)
        this.loadTitleCacheAsync(titleKey, titleCache);

        this.loadedTitles.set(titleKey, titleCache);
        return titleCache;
    }

    /**
     * Асинхронная загрузка кэша тайтла с диска
     */
    private async loadTitleCacheAsync(titleKey: string, titleCache: TitleCache): Promise<void> {
        try {
            const filePath = this.getTitleCacheFilePath(titleKey);
            const exists = await this.adapter.exists(filePath);
            
            if (!exists) {
                return; // Файл не существует — используем пустой кэш
            }

            const content = await this.adapter.read(filePath);

            if (!content.trim()) {
                console.warn(`ChapterIndexCache: empty cache file for title "${titleKey}"`);
                return;
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
                return;
            }

            // Обновляем данные в уже созданном объекте
            titleCache.data = parsed;
            titleCache.dirty = false;
        } catch (err) {
            console.warn(`ChapterIndexCache: failed to load cache for title "${titleKey}"`, err);
            // Используем пустой кэш при ошибке
        }
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