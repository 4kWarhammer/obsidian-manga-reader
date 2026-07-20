import * as React from "react";
import { 
    App,
    TFile,
    TFolder,
    CachedMetadata,
    normalizePath,
    EventRef,
    WorkspaceLeaf,
} from "obsidian";
import { extractMarkdownSection } from "../utils/extractMarkdownSection";

// Шаблон на доработку
const TEMPLATE = (titleName: string) => `---
tags: [manga]
created: {{date}}
---
# Описание

# Комментарии
`;

export function useTitleNote(
    app: App,
    titlePath: string,
    notesFolder: string
) {
    const [notePath, setNotePath] = React.useState<string | null>(null);
    const [content, setContent] = React.useState<string>("");
    const [tags, setTags] = React.useState<string[]>([]);
    const [exists, setExists] = React.useState(false);

    // Генерируем путь к заметке единообразно для vault/external тайтлов
    const computedPath = React.useMemo(() => {
        const safeName = titlePath
            .split(/[\\/]/)
            .join(" – ")
            .replace(/[:*?"<>|]/g, "_");
        return normalizePath(`${notesFolder}/${safeName}.md`);
    }, [titlePath, notesFolder]);

    // Открыть существующую или создать новую
    const openOrCreate = React.useCallback(async () => {
        let file = app.vault.getAbstractFileByPath(computedPath);
        
        // Если объект существует, но это папка — прерываем выполнение
        if (file instanceof TFolder) {
            console.error("По указанному пути находится папка, а не файл");
            return;
        }

        // Если файл не найден, создаем его
        if (!(file instanceof TFile)) {
            // Создаем промежуточные папки
            const folderPath = computedPath.substring(0, computedPath.lastIndexOf("/"));
            if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
                await app.vault.createFolder(folderPath);
            }

            // Спорно путь в название ставить
            const titleName = titlePath.split(/[\\/]/).pop() || "Untitled";
            const body = TEMPLATE(titleName).replace(
                "{{date}}",
                window.moment().format("YYYY-MM-DD")
            );
            
            // Перезаписываем переменную. Теперь TS знает, что здесь точно TFile
            file = await app.vault.create(computedPath, body);
        }

        // Ищем уже открытую вкладку с этим файлом
        const target = file as TFile;

        // Ищем строго среди markdown-вкладок (надежнее, чем iterateAllLeaves)
        const existing = app.workspace.getLeavesOfType("markdown").find(
            (leaf) => (leaf.view as any)?.file?.path === target.path
        );

        if (existing) {
            // revealLeaf гарантированно переключает workspace на нужную вкладку/сплит,
            // setActiveLeaf делает её активной
            app.workspace.revealLeaf(existing);
            app.workspace.setActiveLeaf(existing, { focus: true });
            return;
        }

        // Не найдена — открываем новую
        const leaf = app.workspace.getLeaf("tab");
        await leaf.openFile(target, { active: true });
    }, [app, computedPath, titlePath]);

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

        const checkAndRead = async () => {
            const file = app.vault.getAbstractFileByPath(computedPath);
            if (file instanceof TFile) {
                setNotePath(file.path);
                setExists(true);
                const text = await app.vault.cachedRead(file);
                setContent(text);
                const cache = app.metadataCache.getFileCache(file);
                const fmTags = cache?.frontmatter?.tags;
                setTags(parseTags(fmTags));
            } else {
                setNotePath(computedPath); // путь для будущего создания
                setExists(false);
                setContent("");
                setTags([]);
            }
        };

        checkAndRead();

        // metadataCache.on('changed') строго типизировано:
        // (file: TFile, data: string, cache: CachedMetadata) => any
        const handler = (_file: TFile, _data: string, _cache: CachedMetadata) => {
            // _file содержит TFile, но нам достаточно проверить путь,
            // чтобы не гоняться за каждым изменением в vault
            if (_file.path === computedPath) {
                checkAndRead();
            }
        };

        eventRef = app.metadataCache.on("changed", handler);

        return () => {
            if (eventRef) {
                app.metadataCache.offref(eventRef);
            }
        };
    }, [app, computedPath]);

    return {
        content,
        description,
        comments,
        tags,
        exists,
        notePath,
        openOrCreate
    };
}

function parseTags(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.flat().map(String).filter(Boolean);
    }
    if (typeof raw === "string") {
        return raw.split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
}