// === ЧАСТЬ 1: Типы и интерфейсы ===
// Описываем какой должен быть кэшированный элемент

interface CacheEntry {
    blobUrl: string;
}

// === ЧАСТЬ 2: Сам класс ===
// пришел к выводу, что ImageCache должен быть глупым, а значит
// нужно убрать LRU-менеджмент.
export class ImageCache {
    // private поля (видны только внутри класса):
    private cache = new Map<number, CacheEntry>();
    
    // === МЕТОДЫ ===
    
    // Получить URL из кэша (или null если не загружен)
    get(index: number): string | null {
        const entry = this.cache.get(index);
        return entry ? entry.blobUrl : null;
    }
    
    // Сохранить в кэш
    set(index: number, blobUrl: string): void {
        this.cache.set(index, { blobUrl });
    }

    // Выгрузить конкретное изображение
    release(index: number): void {
        const entry = this.cache.get(index);

        if (!entry) return;

        URL.revokeObjectURL(entry.blobUrl);
        this.cache.delete(index);
    }
    
    // Очистить всё (для cleanup)
    clear(): void {
        for (const index of Array.from(this.cache.keys())) {
            this.release(index);
        }
        console.log('ImageCache: Cleared all images from cache');
    }
}