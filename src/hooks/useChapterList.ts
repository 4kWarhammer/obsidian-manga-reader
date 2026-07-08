import * as React from "react";
import { App, TFolder } from "obsidian";

const fs = (window as any).require ? (window as any).require("fs") : null;

/**
 * Дает список глав
 */
export function useChapterList(
    app: App,
    folderPath: string
): string[] {
    const [chapters, setChapters] = React.useState<string[]>([]);

    React.useEffect(() => {
        const isExternal = folderPath.includes(":\\") || folderPath.startsWith("/");

        // Логика для внешнего источника
        if (isExternal && fs) {
            try {
                const files = fs.readdirSync(folderPath, { withFileTypes: true });

                const chapterNames = files
                    .filter((f: any) =>
                        f.isDirectory() ||
                        f.name.toLowerCase().endsWith(".zip") ||
                        f.name.toLowerCase().endsWith(".cbz")
                    )
                    .map((f: any) => f.name)
                    .sort((a: string, b: string) =>
                        a.localeCompare(b, undefined, { numeric: true })
                    );

                setChapters(chapterNames);
            } catch (error) {
                console.error("Failed to read external chapters", error);
                setChapters([]);
            }

            return;
        }

        // Логика для внутреннего источника
        const folder = app.vault.getAbstractFileByPath(folderPath);

        if (folder instanceof TFolder) {
            const chapterNames = folder.children
                .filter(file =>
                    file instanceof TFolder ||
                    file.name.toLowerCase().endsWith(".zip") ||
                    file.name.toLowerCase().endsWith(".cbz")
                )
                .map(file => file.name)
                .sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true })
                );

            setChapters(chapterNames);
            return;
        }

        setChapters([]);
    }, [app, folderPath]);

    return chapters;
}