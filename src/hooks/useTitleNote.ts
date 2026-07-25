import * as React from "react";
import { 
    App,
    TFile,
    TFolder,
    CachedMetadata,
    normalizePath,
    EventRef,
} from "obsidian";
import { extractMarkdownSection } from "../utils/extractMarkdownSection";
import { sanitizeFileName } from "src/utils/TitleUtils";

// Шаблон на доработку
const TEMPLATE = (titleName: string) => `---
tags: [manga]
year: 
rating: 
aliases: []
created: {{date}}
---
# Описание

# Комментарии
`;

export interface NoteFrontmatter {
    tags?: string[];
    year?: number | null;
    rating?: number | null;
    aliases?: string[];
}

export function useTitleNote(
    app: App,
    titleName: string,           // уже готовое имя (с fallback)
    notesFolder: string,
    noteFileName?: string,       // текущее имя файла из MangaProgress
    onNoteFileNameChange?: (newName: string) => void
) {
    const [notePath, setNotePath] = React.useState<string | null>(null);
    const [content, setContent] = React.useState<string>("");
    const [tags, setTags] = React.useState<string[]>([]);
    const [year, setYear] = React.useState<number | null>(null);
    const [rating, setRating] = React.useState<number | null>(null);
    const [aliases, setAliases] = React.useState<string[]>([]);
    const [exists, setExists] = React.useState(false);

    const desiredFileName = React.useMemo(() => {
        return `${sanitizeFileName(titleName)}.md`;
    }, [titleName]);

    const noteFullPath = React.useMemo(() => {
        return normalizePath(`${notesFolder}/${desiredFileName}`);
    }, [notesFolder, desiredFileName]);

    // Стабилизируем колбэк, чтобы ensureNote не пересоздавался каждый рендер
    const onChangeRef = React.useRef(onNoteFileNameChange);
    // Вот это интересно, иногда можно просто напрямую синхронно обновлять ref
    onChangeRef.current = onNoteFileNameChange;
    // Но иногда нужен эффект
    // React.useEffect(() => {
    //     onChangeRef.current = onNoteFileNameChange;
    // }, [onNoteFileNameChange]);

    // Вынесли наружу, чтобы можно было позвать из ensureNote
    const checkAndRead = React.useCallback(async () => {
        const file = app.vault.getAbstractFileByPath(noteFullPath);
        if (file instanceof TFile) {
            setNotePath(file.path);
            setExists(true);
            const text = await app.vault.cachedRead(file);
            setContent(text);
            // Парсим frontmatter
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter;

            setTags(parseStringArray(fm?.tags));
            setYear(parseNumber(fm?.year));
            setRating(parseRating(fm?.rating));
            setAliases(parseStringArray(fm?.aliases));
        } else {
            setNotePath(noteFullPath);
            setExists(false);
            setContent("");
            setTags([]);
            setYear(null);
            setRating(null);
            setAliases([]);
        }
    }, [app, noteFullPath]);

    /** 
     * Гарантирует, что заметка существует по актуальному пути.
     * Переименовывает старую, если необходимо, или создаёт новую.
     * Возвращает TFile если файл готов, иначе null.
     */
    const ensureNote = React.useCallback(async (): Promise<void> => {
        // 1. Переименование старой заметки
        if (noteFileName && noteFileName !== desiredFileName) {
            const oldPath = normalizePath(`${notesFolder}/${noteFileName}`);
            const oldFile = app.vault.getAbstractFileByPath(oldPath);

            if (oldFile instanceof TFile) {
                try {
                    await app.fileManager.renameFile(oldFile, noteFullPath);
                    onChangeRef.current?.(desiredFileName);
                } catch (err: any) {
                    console.error("Cannot rename note:", err);
                    // Если переименовать не вышло — откроем старый файл позже
                    return;
                }
            }
        }

        // 2. Проверяем, есть ли файл по актуальному пути
        let targetFile = app.vault.getAbstractFileByPath(noteFullPath);

        // 3. Создаём, если нет
        if (!(targetFile instanceof TFile)) {
            const folderPath = noteFullPath.substring(0, noteFullPath.lastIndexOf("/"));
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                try {
                    await app.vault.createFolder(folderPath);
                } catch (err: any) {
                    if (!err?.message?.toLowerCase().includes("already exists")) {
                        throw err;
                    }
                }
            }

            const body = TEMPLATE(titleName).replace(
                "{{date}}",
                window.moment().format("YYYY-MM-DD")
            );

            targetFile = await app.vault.create(noteFullPath, body);
            onChangeRef.current?.(desiredFileName);
        }

        // 4. Если noteFileName вообще не был записан — фиксируем
        if (!noteFileName) {
            onChangeRef.current?.(desiredFileName);
        }

        // 5. Принудительно перечитаем содержимое, т.к. useEffect чтения мог отработать раньше создания
        await checkAndRead();
    }, [
        app,
        notesFolder,
        noteFullPath,
        desiredFileName,
        noteFileName,
        titleName,
        checkAndRead,
    ]);

    /** Только открывает файл по актуальному noteFullPath */
    const openNote = React.useCallback(async () => {
        const file = app.vault.getAbstractFileByPath(noteFullPath);

        if (!file) {
            console.warn("Заметка не найдена по пути:", noteFullPath);
            return;
        }

        if (file instanceof TFolder) {
            console.error("По указанному пути находится папка, не файл");
            return;
        }

        const target = file as TFile;

        const existing = app.workspace
            .getLeavesOfType("markdown")
            .find((leaf) => (leaf.view as any)?.file?.path === target.path);

        if (existing) {
            app.workspace.revealLeaf(existing);
            app.workspace.setActiveLeaf(existing, { focus: true });
            return;
        }

        const leaf = app.workspace.getLeaf("tab");
        await leaf.openFile(target, { active: true });
    }, [app, noteFullPath]);

    /**
     * Обновляет поля frontmatter заметки.
     * Если файла ещё нет — предварительно создаёт его через ensureNote().
     * Переданные undefined-поля игнорируются (чтобы не затереть соседние ключи).
     */
    const updateFrontmatter = React.useCallback(async (updates: Partial<NoteFrontmatter>) => {
        let file = app.vault.getAbstractFileByPath(noteFullPath);

        // Если заметки нет — создаём
        if (!(file instanceof TFile)) {
            await ensureNote();
            file = app.vault.getAbstractFileByPath(noteFullPath);
            if (!(file instanceof TFile)) {
                console.error("Failed to create note for frontmatter update");
                return;
            }
        }

        // Обновляем наши ранее объявленные поля (новые не будут работаь скорее всего?)
        await app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (updates.tags !== undefined) {
                frontmatter.tags = updates.tags;
            }
            if (updates.year !== undefined) {
                frontmatter.year = updates.year;
            }
            if (updates.rating !== undefined) {
                frontmatter.rating = updates.rating;
            }
            if (updates.aliases !== undefined) {
                frontmatter.aliases = updates.aliases;
            }
        });
        
        // processFrontMatter вызовет metadataCache.changed → хук сам перечитает стейты.
        // Принудительный checkAndRead() здесь не обязателен.
    }, [app, noteFullPath, ensureNote]);

    const description = React.useMemo(() => {
        if (!content) return null;
        // Берём секцию "Описание" (регистр не важен)
        return extractMarkdownSection(content, "Описание");
    }, [content]);

    const comments = React.useMemo(() => {
        if (!content) return null;
        // Берём секцию "Описание" (регистр не важен)
        return extractMarkdownSection(content, "Комментарии");
    }, [content]);

    // Читаем содержимое + подписываемся на изменения в vault
    React.useEffect(() => {
        let eventRef: EventRef

        checkAndRead();

        // metadataCache.on('changed') строго типизировано:
        // (file: TFile, data: string, cache: CachedMetadata) => any
        const handler = (_file: TFile, _data: string, _cache: CachedMetadata) => {
            // _file содержит TFile, но нам достаточно проверить путь,
            // чтобы не гоняться за каждым изменением в vault
            if (_file.path === noteFullPath) {
                checkAndRead();
            }
        };

        eventRef = app.metadataCache.on("changed", handler);

        return () => {
            if (eventRef) {
                app.metadataCache.offref(eventRef);
            }
        };
    }, [app, noteFullPath, checkAndRead]);

    return {
        content,
        description,
        comments,
        tags,
        year,
        rating,
        aliases,
        exists,
        notePath,
        ensureNote,
        openNote,
        updateFrontmatter
    };
}

function parseStringArray(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.flat().map(String).filter(Boolean);
    }
    if (typeof raw === "string") {
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

function parseNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const num = Number(raw);
    return isNaN(num) ? null : num;
}

/** Парсит значение из поля rating, можно как число, так и текст */
export function parseRating(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;

    // Если уже число — сразу ограничиваем
    if (typeof raw === "number") return clampRating(raw);

    // Нормализуем: запятая → точка, убираем пробелы по краям
    let str = String(raw).trim().replace(",", ".");

    // Пытаемся выхватить первое валидное число
    // (на случай если пользователь ввёл "8/10" или "9 из 10")
    const match = str.match(/^-?\d+(\.\d+)?/);
    if (match) str = match[0];

    const num = Number(str);
    return isNaN(num) ? null : clampRating(num);
}

/**Ограничитель, выдает число только в диапазоне от 0 до 10 */
function clampRating(num: number): number {
    if (num < 0) return 0;
    if (num > 10) return 10;
    return num;
}
