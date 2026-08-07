import * as React from "react";
import { App, TFolder, TAbstractFile } from "obsidian";
import { translations } from "src/i18n";
import MangaReaderPlugin from "src/main";

// Безопасно получаем доступ к Node.js (только на десктопе)
const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;

interface Props {
    app: App;
    mode: "vault" | "external" // Добавляем режим
    plugin:MangaReaderPlugin,
    onSelect: (path: string) => void;
    onClose: () => void;
}

export const FolderBrowser = ({ app, mode, plugin, onSelect, onClose }: Props) => {
    const t = translations[plugin.data.settings.language]
    const [currentPath, setCurrentPath] = React.useState<string>(mode === "vault" ? "" : "C:\\"); 
    const [folders, setFolders] = React.useState<{name: string, path: string}[]>([]);


    const explorerBack = (mode: string) => {
        if (mode === "vault") {
            const parts = currentPath.split("/");
            parts.pop();
            setCurrentPath(parts.join("/"));
        } else {
            // Для внешних путей используем модуль path
            const parent = pathModule.dirname(currentPath);
            setCurrentPath(parent);
        }
    };

    // Получаем папки по текущему пути
    React.useEffect(() => {
        if (mode === "vault") {
            // ЛОГИКА VAULT, поиск по внутреннему хранилищу
            const root = app.vault.getAbstractFileByPath(currentPath || "/");
            if (root instanceof TFolder) {
                const subFolders = root.children
                    .filter(f => f instanceof TFolder)
                    .map(f => ({ name: f.name, path: f.path }));
                setFolders(subFolders);
            }
        } else if (mode === "external" && fs && pathModule) {
            // ЛОГИКА NODE.JS (Внешние папки)
            try {
                const files = fs.readdirSync(currentPath, { withFileTypes: true });
                const subFolders = files
                    .filter((f: any) => f.isDirectory())
                    .map((f: any) => ({
                        name: f.name,
                        path: pathModule.join(currentPath, f.name)
                    }));
                setFolders(subFolders);
            } catch (err) {
                console.error("Ошибка чтения папки:", err);
                // setFolders([]); // Как будто не надо, ведь если ошибка - setFolders обнулит данные
            }
        }
    }, [currentPath, app, mode]);

    return (
        <div style={{ padding: "10px" }}>
            <div 
                style={{ 
                    marginBottom: "15px", 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "5px" 
                    }}
            >
                <div style={{ fontSize: "0.8em", color: "var(--text-muted)" }}>
                    {t.explorer.mode} {mode === "vault" ? t.explorer.vaultMode : t.explorer.externalMode}
                </div>
                <strong style={{ wordBreak: "break-all" }}>
                    {mode === "vault" ? "Vault/" : ""}{currentPath || "/"}
                </strong>
            </div>

            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--background-modifier-border)" }}>
                {/* Кнопка "Назад" */}
                {currentPath !== "" && (
                    <div 
                        onClick={() => {
                            explorerBack (mode)
                        }}
                        style={{ padding: "8px", cursor: "pointer", color: "var(--text-accent)" }}
                    >
                        {t.explorer.back}
                    </div>
                )}

                {/* Список папок */}
                {folders.map(folder => (
                    <div 
                        key={folder.path}
                        onClick={() => setCurrentPath(folder.path)}
                        style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid var(--background-modifier-border-low)" }}
                    >
                        📁 {folder.name}
                    </div>
                ))}
            </div>
            
        <button 
            className="mod-cta" // Класс Obsidian для акцентной кнопки
            style={{ marginTop: "15px", width: "100%" }} 
            onClick={() => onSelect(currentPath)}
        >
            {t.explorer.choose} {currentPath.split(/[\\/]/).pop() || t.explorer.root}
        </button>

        </div>
    );
};