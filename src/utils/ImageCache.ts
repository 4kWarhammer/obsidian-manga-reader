// === ЧАСТЬ 1: Типы и интерфейсы ===
// Описываем какой должен быть кэшированный элемент

interface CacheEntry {
    blobUrl: string;
    timestamp: number;
}

// === ЧАСТЬ 2: Сам класс ===
export class ImageCache {
    // private поля (видны только внутри класса):
    private cache = new Map<number, CacheEntry>();
    // Конструктор с параметром maxImages (по умолчанию 10)
    constructor(private maxImages: number = 10) {}
    
    // === МЕТОДЫ ===
    
    // Получить URL из кэша (или null если не загружен)
    get(index: number): string | null {
        const entry = this.cache.get(index);
        return entry ? entry.blobUrl : null;
    }
    
    // Сохранить в кэш
    set(index: number, blobUrl: string): void {
        // Если кэш полный - выгрузить старейший
        if (this.cache.size >= this.maxImages) {
            this.releaseOldest();
            console.log(`ImageCache: Cache is full (max: ${this.maxImages}), releasing oldest image`);
        }
        // Добавляем новый элемент в кэш
        this.cache.set(index, { blobUrl, timestamp: Date.now() });
        console.log(`ImageCache: Cached image at index ${index}`);

    }

    // Выгрузить конкретное изображение
    release(index: number): void {
        if (this.cache.has(index)) {
            const toRelease = this.cache.get(index)!.blobUrl;
            URL.revokeObjectURL(toRelease);
            this.cache.delete(index);
            // console.log(`ImageCache: Released image at index ${index}`);
        } else {
            // console.warn(`ImageCache: Image at index ${index} does not exist in cache`);
        }
    }
    
    // Выгрузить самое старое изображение (ПОМОЩНИК для set)
    private releaseOldest(): void {
        let oldestIndex = -1;
        let oldestTime = Infinity;

        this.cache.forEach((entry, index) => {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestIndex = index;
            }
        })

        if (oldestIndex !== -1) {
            this.release(oldestIndex);
            console.log(`ImageCache: Released oldest image at index ${oldestIndex}`);
        } else {
            console.warn('ImageCache: No images to release');
        }
    }
    
    // Очистить всё (для cleanup)
    clear(): void {
        this.cache.forEach((entry, index) => {
            this.release(index);
        })
        console.log('ImageCache: Cleared all images from cache');
    }
}