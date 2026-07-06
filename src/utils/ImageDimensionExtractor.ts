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