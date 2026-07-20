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

// Шаблон на доработку
const TEMPLATE = (titleName: string) => `---
tags: [manga]
created: {{date}}
---

# ${titleName}

Описание:

Теги:
`;

export function useTitleNote(
    app: App,
    titlePath: string,
    notesFolder: string
) {
    const [notePath, setNotePath] = React.useState<string | null>(null);
    const [content, setContent] = React.useState<string>("");
    const [exists, setExists] = React.useState(false);

    // Генерируем путь к заметке единообразно для vault/external тайтлов
    const computedPath = React.useMemo(() => {
        const safeName = titlePath
            .split(/[\\/]/)
            .join(" – ")
            .replace(/[:*?"<>|]/g, "_");
        return normalizePath(`${notesFolder}/${safeName}.md`);
    }, [titlePath, notesFolder]);

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
            } else {
                setNotePath(computedPath); // путь для будущего создания
                setExists(false);
                setContent("");
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

        const target = file as TFile;

        // Ищем уже открытую вкладку с этим файлом
        let existingLeaf: WorkspaceLeaf | null = null;

        // Перебираем все вкладки, группы и окна
        app.workspace.iterateAllLeaves((leaf) => {
            // FileView (markdown, image и др.) хранит ссылку на файл
            if ((leaf.view as any)?.file?.path === target.path) {
                existingLeaf = leaf;
            }
        });

        if (existingLeaf) {
            app.workspace.setActiveLeaf(existingLeaf, { focus: true });
        } else {
            // Если не открыта, то создаем окно
            const leaf = app.workspace.getLeaf("tab");
            await leaf.openFile(file as TFile, { active: true });
        }
    }, [app, computedPath, titlePath]);


    return { content, exists, notePath, openOrCreate };
}