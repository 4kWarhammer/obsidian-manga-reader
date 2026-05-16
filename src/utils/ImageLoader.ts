import { App, TFolder, TFile } from "obsidian";
import JSZip from "jszip";
import { ImageCache } from "./ImageCache";

// Достаем Node.js модули
const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;

// Это загрузчик изображений,
// но одного ли изображения?

export class ImageLoader {
    // Это просто список изображений, не содержит в себе ссылок или 
    // какой-либо дополнительной информации.
    // Нужен для позиционирования индексов и выявления totalpages
    private imageFilesList: string[] | null = null;
    // Для случаев с архивами, кладем сюда Binary Data, чтобы быстро из памяти грузить
    // и не дергать диск постоянными запросами по одному файлу
    private zipPromise: Promise<JSZip> | null = null;

    constructor(
        private parentPath: string,    // "/vault/Manga" или "C:\Manga"
        private chapterName: string,   // "chapter_1" или "chapter_1.zip"
        private cache: ImageCache,     // Объект ImageCache
        private isArchive: boolean,    // true если .zip/.cbz
        private isExternal: boolean,   // true если внешняя папка (не в vault)
        private app: App,              // Obsidian App для работы с vault
    ) { }
    
    // Чисто для случаев с архивами, грузим в наш промис объект для пользования
    private async getZip(): Promise<JSZip> {
        if (!this.zipPromise) {
            this.zipPromise = this.loadZip();
        }

        return this.zipPromise;
    }

    // Метод загрузки Binary Data из архива
    private async loadZip(): Promise<JSZip> {
        const archivePath = this.isExternal 
            ? pathModule.join(this.parentPath, this.chapterName)
            : `${this.parentPath}/${this.chapterName}`;

        let binaryData: ArrayBuffer;

        if (this.isExternal) {
            const buffer = await fs.promises.readFile(archivePath);
            binaryData = this.bufferToArrayBuffer(buffer);
        } else {
            const file = this.app.vault.getAbstractFileByPath(archivePath);
            if (!file) {
                throw new Error(`File not found: ${archivePath}`);
            }

            binaryData = await this.app.vault.readBinary(file as TFile);
        }

        return JSZip.loadAsync(binaryData);
    }

    // Очищаем zipPromise по запросу
    clearArchiveCache(): void {
        this.zipPromise = null;
    }

    clear(): void {
        this.clearArchiveCache();
    }

    private bufferToArrayBuffer(buffer: any): ArrayBuffer {
        return buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
        );
    }

    /**
     * Метод ImageLoader
     * Загружает 1 изображение по индексу и возвращает Blob URL для отображения.
     * 
     * Проверяет кэш перед загрузкой. Если изображение не в кэше — загружает
     * из архива или папки, создаёт Blob URL и сохраняет в кэш.
     * 
     * @returns Promise с Blob URL (object URL)
     */
    async load(index: number): Promise<string> {
        //1. Проверяем кэш и отдаем URL если уже загружено
        const cached = this.cache.get(index);
        if (cached) {
            return cached;
        }
        
        // 2. Если нет в кэше → загружаем
        // Получаем список файлов (из архива или папки)
        const files = await this.getImageFilesList();
        
        // Выбираем нужный файл по индексу
        const fileName = files[index];
        if (!fileName) {
            throw new Error(`Image at index ${index} not found`);
        }
        // Загружаем конкретный файл
        const arrayBuffer = await this.loadFile(fileName);

        // Создаем Blob и Blob URL
        const mimeType = this.getMimeType(fileName);
        const blob = new Blob([arrayBuffer], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        // Сохраняем в кэш
        this.cache.set(index, blobUrl);
        
        return blobUrl;
    }

    // ПОМОЩНИК: Загружает конкретный файл в память (ArrayBuffer или Blob)
    private async loadFile(fileName: string): Promise<ArrayBuffer> {
        
        if (this.isArchive) {            
            // Открываем архив с помощью JSZip
            const zip = await this.getZip();
            
            // Выбираем нужный файл внутри архива
            const fileInZip = zip.file(fileName);
            // zip.file("page_001.jpg") вернет объект файла или null
            
            if (!fileInZip) {
                throw new Error(`Image Loader: file ${fileName} not found in archive`);
            }
            
            // Распаковываем файл в ArrayBuffer
            const fileData = await fileInZip.async("arraybuffer");
            // async("arraybuffer") = распаковать в ArrayBuffer формат
            
            return fileData;
        } else {
            const filePath = this.isExternal 
                ? pathModule.join(this.parentPath, this.chapterName, fileName)
                : `${this.parentPath}/${this.chapterName}/${fileName}`;

            if (this.isExternal) {
                const buffer = await fs.promises.readFile(filePath);

                // Преобразуем в ArrayBuffer
                return this.bufferToArrayBuffer(buffer);
                // .buffer = доступ к ArrayBuffer внутри Buffer
                // .slice() = берем кусок ArrayBuffer (весь файл)
            } else {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (!file) {
                    throw new Error(`File not found: ${filePath}`);
                }
                return await this.app.vault.readBinary(file as TFile);
                // readBinary = читаем как бинарные данные (ArrayBuffer)
            }
        }
    }

    // ПОМОЩНИК: Получает список файлов (изображений) в главе
    private async getImageFilesList(): Promise<string[]> {
        // Если список уже загружен → вернуть его
        if (this.imageFilesList !== null) {
            console.log("ImageLoader: Using cached file list");
            return this.imageFilesList;
        }

        console.log("ImageLoader: Loading file list from disk");
        let files: string[] = [];

        // Логика пути для внешних и внутренних путей
        const fullPath = this.isExternal 
            ? pathModule.join(this.parentPath, this.chapterName)
            : `${this.parentPath}/${this.chapterName}`;

        if (this.isArchive) {
            const zip = await this.getZip();
            files = Object.keys(zip.files);
        } else {
            if (this.isExternal) {
                files = await fs.promises.readdir(fullPath);
            } else {
                const folder = this.app.vault.getAbstractFileByPath(fullPath);

                // Проверка, что это папка
                if (!(folder instanceof TFolder)) return [];

                files = folder.children
                    .map(item => item.name);
            }
        }

        // Фильтруем только изображения
        const imageFiles = files.filter(fileName => {
            return /\.(jpg|jpeg|png|webp|avif)$/i.test(fileName);
        });

        // сортируем с помощью localeCompare - умное сравнение
        const sortedImageFiles = imageFiles.sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true});
        });

        // Сохраняем в кэш
        this.imageFilesList = sortedImageFiles;
        // Возвращаем отсортированный список
        return sortedImageFiles;
    }

    /**
     * Метод ImageLoader
     * 
     * Возвращает количество страниц в главе
     * 
     * @returns files.length
     */
    async getTotalPages(): Promise<number> {
        const files = await this.getImageFilesList();
        return files.length;
    }

    // Определяет MIME тип по расширению на конце файла
    private getMimeType(fileName: string): string {
            const ext = fileName.split('.').pop()?.toLowerCase() || '';

            const types: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
                'avif': 'image/avif'
            };
            
            return types[ext] || 'image/jpeg';
    }
}