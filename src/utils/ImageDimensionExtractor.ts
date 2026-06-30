// Класс, позволяющий собирать метаданные от изображений


export interface ExtractedDimensions {
    width: number;
    height: number;
    aspectRatio: number;
    mimeType: string;
}

export const INDEXER_CONCURRENCY = 2;
export const BACKGROUND_INDEXER_CONCURRENCY = 1;


// Создает Blob, вызывает createImageBitmap
// Потом добавим headerParser

/**
 * Вытаскивает метаданные из ArrayBuffer изображения
 * 
 * Возвращает размеры и соотношение сторон изображения
 */
export class ImageDimensionExtractor {
    // Статический метод, не зависит от объекта и принадлежит
    // только самому класу - не нужно писать const parser = new Parser();
    static async extract(
        buffer: ArrayBuffer,
        mimeType: string
    ): Promise<ExtractedDimensions> {
        const blob = new Blob([buffer], { type: mimeType });
        let bitmap: ImageBitmap | null = null;

        try {
            bitmap = await createImageBitmap(blob);
            return {
                width: bitmap.width,
                height: bitmap.height,
                aspectRatio: bitmap.width / bitmap.height,
                mimeType,
            };
        } finally {
            bitmap?.close();
        }
    }
}

/**
 * Concurrency helper.
 * 
 * Это generic utility - за счет использования T может выдавать на выход разные структуры данных
 * 
 * 
 * @param items Array<{ buffer: ArrayBuffer; mimeType: string }>,
 * @param concurrency number,
 * @param extractor (buffer: ArrayBuffer, mimeType: string) => Promise<T>
 * @param onItemDone Если просто индекс показывать, то норм, но из-за concurrency реальный порядок может отличаться
 * так что с именами файлов не будет строгой последовательности
 * @returns 
 */
export async function extractWithConcurrency<T>(
    items: Array<{ buffer: ArrayBuffer; mimeType: string }>,
    concurrency: number,
    extractor: (buffer: ArrayBuffer, mimeType: string) => Promise<T>,
    onItemDone?: (index: number, result: T) => void // callback функция, передает выше информацию о состоянии загрузки
): Promise<T[]> {
    const results: T[] = new Array(items.length);
    let nextIndex = 0;
    const workers: Promise<void>[] = [];

    // Вроде понял работу, но лучше переписать в цикле с этой функцией
    async function startWorker() {
        while (nextIndex < items.length) {
            const idx = nextIndex++;
            const { buffer, mimeType } = items[idx];
            const result = await extractor(buffer, mimeType);
            results[idx] = result;
            onItemDone?.(idx, result);
        }
    }

    for (let i = 0; i < concurrency; i++) {
        workers.push(
            (async () => {
                await startWorker();
            })()
        );
    }

    await Promise.all(workers);
    return results;
}



