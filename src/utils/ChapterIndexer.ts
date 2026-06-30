// ============================================================
// Индексирует одну главу: получает список файлов, загружает каждый буфер, 
// извлекает размеры через createImageBitmap, возвращает CachedChapterIndex.
// ============================================================

import {
    CachedChapterIndex,
    ChapterSignature,
    ChapterSignatureArchive,
    ChapterSignatureFolder,
    ChapterSourceType,
    CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
    CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
} from 'src/types';
import {
    ChapterIndexerOptions,
    ChapterIndexerProgress,
} from 'src/utils/indexTypes';
import { 
    ImageDimensionExtractor, 
    extractWithConcurrency, 
    INDEXER_CONCURRENCY 
} from 'src/utils/ImageDimensionExtractor';
import { ImageLoader } from './ImageLoader';
import { ImageCache } from 'src/utils/ImageCache';
import { logger } from 'src/utils/logger';

const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;


// ============================================================
// ChapterIndexer
// ============================================================

export class ChapterIndexer {
    /**
     * Основная функция для индексации работает с главами
     * @param opts 
     * @param onProgress 
     * @returns CachedChapterIndex
     */
    async index(
        opts: ChapterIndexerOptions,
        onProgress?: (progress: ChapterIndexerProgress) => void
    ): Promise<CachedChapterIndex> {
        const startedAt = performance.now();
        const { signal } = opts;

        // 1. Сигнатура
        const signature = await this.computeSignature(opts);

        // 2. Список файлов
        const loader = this.createLoader(opts);

        try {
            const imageFiles = await loader.getImageFilesList();
            const totalFilesCount = imageFiles.length;

            if (totalFilesCount === 0) {
                return this.buildEmptyIndex(opts, signature);
            }

            // 3. Загружаем буферы
            const items = await this.loadImageBuffers(loader, imageFiles, signal);

            // 4. Извлекаем размеры
            const pages: CachedChapterIndex['pages'] = [];

            let completed = 0;

            const extracted = await extractWithConcurrency(
                items,
                INDEXER_CONCURRENCY,
                async (buffer, mimeType) => {
                    if (signal?.aborted) {
                        throw new Error('Aborted during extraction');
                    }
                    return await ImageDimensionExtractor.extract(buffer, mimeType);
                },
                index => {
                    completed++;

                    onProgress?.({
                        loaded: completed,
                        total: totalFilesCount,
                        currentFile: imageFiles[index],
                    });
                }
            );

            for (let i = 0; i < extracted.length; i++) {
                const dim = extracted[i];

                pages.push({
                    index: i,
                    fileName: imageFiles[i],
                    width: dim.width,
                    height: dim.height,
                    aspectRatio: dim.aspectRatio,
                    mimeType: dim.mimeType,
                });
            }

            const elapsed = performance.now() - startedAt;
            logger.perf(`ChapterIndexer: indexed ${opts.chapterName} in ${elapsed.toFixed(0)}ms (${totalFilesCount} pages)`);

            return {
                chapterKey: opts.chapterKey,
                titleKey: opts.titleKey,
                sourcePath: opts.parentPath,
                sourceType: this.detectSourceType(opts),
                signature,
                schemaVersion: CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
                extractorVersion: CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
                indexedAt: Date.now(),
                pageCount: totalFilesCount,
                pages,
            };

        } finally {
            loader.clearArchiveCache();
        }
    }

    // ============================================================
    // Сигнатура
    // ============================================================

    public async computeSignature(opts: ChapterIndexerOptions): Promise<ChapterSignature> {
        if (opts.isArchive) {
            return this.computeArchiveSignature(opts);
        }
        return this.computeFolderSignature(opts);
    }

    // Расчитываем сигнатуру для архива с изображениями
    private async computeArchiveSignature(opts: ChapterIndexerOptions): Promise<ChapterSignatureArchive> {
        const archivePath = opts.isExternal
        ? pathModule.join(opts.parentPath, opts.chapterName)
        : `${opts.parentPath}/${opts.chapterName}`;

        let size: number;
        let mtime: number;

        if (opts.isExternal) {
            const stat = await fs.promises.stat(archivePath);
            size = stat.size;
            mtime = stat.mtimeMs;
        } else {
            const file = opts.app.vault.getAbstractFileByPath(archivePath);
            if (!file) {
                throw new Error(`Archive not found: ${archivePath}`);
            }
            const buffer = await opts.app.vault.readBinary(file as any);
            size = buffer.byteLength;
            mtime = (file as any).stat.mtime;
        }

        return {
            kind: 'archive',
            path: archivePath,
            size,
            mtime,
        };
    }

    // Расчитываем сигнатуру папки с изображениями
    private async computeFolderSignature(opts: ChapterIndexerOptions): Promise<ChapterSignatureFolder> {
        const loader = this.createLoader(opts);
        const files = await loader.getImageFilesList();

        // Если пустая папка??
        if (files.length === 0) {
            return {
                kind: 'folder',
                path: opts.isExternal
                ? pathModule.join(opts.parentPath, opts.chapterName)
                : `${opts.parentPath}/${opts.chapterName}`,
                fileCount: 0,
                filesHash: '',
            };
        }

        const entries: string[] = [];

        for (const fileName of files) {
            const fullPath = opts.isExternal
                ? pathModule.join(opts.parentPath, opts.chapterName, fileName)
                : `${opts.parentPath}/${opts.chapterName}/${fileName}`;

            let size: number;
            let mtime: number;

            if (opts.isExternal) {
                const stat = await fs.promises.stat(fullPath);
                size = stat.size;
                mtime = stat.mtimeMs;
            } else {
                const file = opts.app.vault.getAbstractFileByPath(fullPath);
                if (!file) continue;
                const buffer = await opts.app.vault.readBinary(file as any);
                size = buffer.byteLength;
                mtime = (file as any).stat.mtime;
            }

            entries.push(`${fileName}:${size}:${mtime}`);
        }

        const sorted = entries.sort();
        const hash = simpleHash(sorted.join('|'));

        return {
            kind: 'folder',
            path: opts.isExternal
                ? pathModule.join(opts.parentPath, opts.chapterName)
                : `${opts.parentPath}/${opts.chapterName}`,
            fileCount: files.length,
            filesHash: hash,
        };
    }

    // ============================================================
    // Загрузка буферов (по одному, без createImageBitmap)
    // ============================================================

    private async loadImageBuffers(
        loader: ImageLoader,
        files: string[],
        signal?: AbortSignal
    ): Promise<Array<{ buffer: ArrayBuffer; mimeType: string }>> {
        const items: Array<{ buffer: ArrayBuffer; mimeType: string }> = [];

        for (let i = 0; i < files.length; i++) {
            if (signal?.aborted) {
                throw new Error('Aborted during buffer loading');
            }

            const fileName = files[i];
            const buffer = await loader.loadFile(fileName);
            const mimeType = loader.getMimeType(fileName);

            items.push({ buffer, mimeType });
        }

        return items;
    }

    // ============================================================
    // Вспомогательные методы
    // ============================================================

    private createLoader(opts: ChapterIndexerOptions): ImageLoader {
        return new ImageLoader(
            opts.parentPath,
            opts.chapterName,
            new ImageCache(),
            opts.isArchive,
            opts.isExternal,
            opts.app
        );
    }

    private detectSourceType(opts: ChapterIndexerOptions): ChapterSourceType {
        if (opts.isArchive) {
            return opts.isExternal ? 'external-archive' : 'vault-archive';
        }
        return opts.isExternal ? 'external-folder' : 'vault-folder';
    }

    private buildEmptyIndex(opts: ChapterIndexerOptions, signature: ChapterSignature): CachedChapterIndex {
        return {
            chapterKey: opts.chapterKey,
            titleKey: opts.titleKey,
            sourcePath: opts.parentPath,
            sourceType: this.detectSourceType(opts),
            signature,
            schemaVersion: CURRENT_IMAGE_INDEX_SCHEMA_VERSION,
            extractorVersion: CURRENT_IMAGE_INDEX_EXTRACTOR_VERSION,
            indexedAt: Date.now(),
            pageCount: 0,
            pages: [],
        };
    }

    // Не нужна уже
    private getMimeType(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        const types: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            avif: 'image/avif',
        };

        return types[ext] || 'image/jpeg';
    }
}

// ============================================================
// simpleHash — простой хэш для строки
// ============================================================

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}