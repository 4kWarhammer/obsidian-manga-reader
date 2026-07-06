// Что делает этот класс:
// Загружает/сохраняет ImageIndexCacheFile (один JSON в plugin dir)
// Проверяет, валидна ли запись для конкретной главы (по signature + версиям)
// Позволяет читать/писать/инвалидировать отдельные главы

// loaded или loadPromise - возможно стоит добавить - ChapterIndexManager
// неявно вызывает в getOrBuildIndex, есть теоретический race condition
import {
    ImageIndexCacheFile,
    CachedChapterIndex,
    ChapterSignature,
    ChapterSignatureArchive,
    ChapterSignatureFolder,
    CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
    CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
} from 'src/types';
import { CacheStorageAdapter } from './indexTypes';

export class ChapterIndexCache {
    private cache: ImageIndexCacheFile | null = null;
    private cachePath: string;
    private dirty = false;
    private adapter: CacheStorageAdapter;

    constructor(cachePath: string, adapter: CacheStorageAdapter) {
        this.cachePath = cachePath;
        this.adapter = adapter;
    }

  // ============================================================
  // Загрузка и сохранение в персистентные метаданные
  // ============================================================

    async load(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) {
            throw new Error('ChapterIndexCache: load aborted');
        }

        try {
            const exists = await this.adapter.exists(this.cachePath);
            if (!exists) {
                this.cache = createEmptyCache();
                return;
            }

            const content = await this.adapter.read(this.cachePath);

            // Перехватываем, если content не создался
            if (!content.trim()) {
                console.warn('ChapterIndexCache: empty cache file, starting fresh');
                this.cache = createEmptyCache();
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
                console.warn('ChapterIndexCache: malformed cache file, starting fresh');
                this.cache = createEmptyCache();
                return;
            }

            this.cache = parsed;
        } catch (err) {
            // Если файл битый или нечитаемый — начинаем с пустого кэша
            console.warn('ChapterIndexCache: failed to load cache, starting fresh', err);
            this.cache = createEmptyCache();
        }
    }

    async save(signal?: AbortSignal): Promise<void> {
        if (!this.dirty || !this.cache) {
            return;
        }

        if (signal?.aborted) {
            throw new Error('ChapterIndexCache: save aborted');
        }

        try {
            this.cache.updatedAt = Date.now();
            const content = JSON.stringify(this.cache, null, 2);
            await this.adapter.write(this.cachePath, content);
            this.dirty = false;
        } catch (err) {
            console.error('ChapterIndexCache: failed to save cache', err);
            // Не бросаем ошибку дальше — кэш не критичен для работы ридера
        }
    }

    // ============================================================
    // Чтение / запись / инвалидация записей
    // ============================================================

    getChapter(chapterKey: string): CachedChapterIndex | undefined {
        return this.cache?.chapters[chapterKey];
    }

    setChapter(index: CachedChapterIndex): void {
        if (!this.cache) {
            this.cache = createEmptyCache();
        }

        this.cache.chapters[index.chapterKey] = index;
        this.dirty = true;
    }

    invalidateChapter(chapterKey: string): void {
        if (!this.cache) return;

        delete this.cache.chapters[chapterKey];
        this.dirty = true;
    }

    getAllChapterKeys(): string[] {
        if (!this.cache) return [];
        return Object.keys(this.cache.chapters);
    }

    // ============================================================
    // Валидация
    // ============================================================

    hasValidChapter(chapterKey: string, signature: ChapterSignature): boolean {
        const entry = this.cache?.chapters[chapterKey];
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
        return this.dirty;
    }

    getCacheSnapshot(): ImageIndexCacheFile | null {
        return this.cache;
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