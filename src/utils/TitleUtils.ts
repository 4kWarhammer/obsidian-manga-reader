import MangaReaderPlugin from "../main";
import { MangaProgress } from "../types";

/**
 * Возвращает или создает запись прогресса для тайтла
 */
export function ensureProgress(
    plugin: MangaReaderPlugin, 
    path: string
): MangaProgress {
    if (!plugin.data.library[path]) {
        plugin.data.library[path] = {
            lastChapter: "",
            lastPage: 1
        };
    }
    return plugin.data.library[path];
}

/** Функция берет имя из library.titleName, с fallback - имя из названия папки */
export function getTitleDisplayName(path: string, progress?: MangaProgress): string {
    if (progress?.titleName) {
        return progress.titleName
    };
    
    const cleaned = path.replace(/[\\/]+$/, "");
    const segments = cleaned.split(/[\\/]/);
    const nameFromFolder = segments[segments.length - 1]

    return nameFromFolder || path;
}

/** 
 * Очищает строку, чтобы её можно было безопасно использовать 
 * как имя файла в операционных системах (особенно в Windows).
 * Заменяем опасные спецсимволы
 * Ограничивает длину названия
 */
export function sanitizeFileName(name: string, maxLength: number = 255): string {
    if (!name) return "unnamed";

    return name
        // 1. Заменяем запрещённые спецсимволы ОС и управляющие (скрытые) ASCII-символы на "_"
        .replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, "_")
        // 2. Удаляем пробелы и точки в начале и конце (Windows их отбрасывает или сбоит)
        .replace(/^[\s.]+|[\s.]+$/g, "")
        // 3. Обрезаем строку до безопасной длины (максимум 255 символов)
        .substring(0, maxLength);
}