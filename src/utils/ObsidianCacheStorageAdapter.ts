import { DataAdapter, normalizePath } from 'obsidian';
import { CacheStorageAdapter } from './indexTypes';


/**
 * В этом случае уместо использовать DataAdapter, потому что это
 * 
 * Служебная часть работы плагина, не относится к стандартным директориям
 */
export class ObsidianCacheStorageAdapter implements CacheStorageAdapter {
    constructor(private adapter: DataAdapter) {}

    async read(path: string): Promise<string> {
        return this.adapter.read(normalizePath(path));
    }

    async write(path: string, content: string): Promise<void> {
        await this.adapter.write(normalizePath(path), content);
    }

    async exists(path: string): Promise<boolean> {
        return this.adapter.exists(normalizePath(path));
    }
}