import * as React from "react";
import { App, TFolder, TAbstractFile } from "obsidian";

interface Props {
    app: App;
    onSelect: (path: string) => void;
    onClose: () => void;
}

export const FolderBrowser = ({ app, onSelect, onClose }: Props) => {
    const [currentPath, setCurrentPath] = React.useState<string>(""); 
    const [folders, setFolders] = React.useState<TFolder[]>([]);

    // Получаем папки по текущему пути
    React.useEffect(() => {
        const root = app.vault.getAbstractFileByPath(currentPath || "/");
        if (root instanceof TFolder) {
            const subFolders = root.children
                .filter(f => f instanceof TFolder) as TFolder[];
            setFolders(subFolders);
        }
    }, [currentPath, app]);

    return (
        <div style={{ padding: "10px" }}>
            <div style={{ marginBottom: "15px", display: "flex", justifyContent: "space-between" }}>
                <strong>Vault/{currentPath || ""}</strong>
                <button onClick={() => onSelect(currentPath)}>Выбрать эту папку</button>
            </div>

            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--background-modifier-border)" }}>
                {/* Кнопка "Назад" */}
                {currentPath !== "" && (
                    <div 
                        onClick={() => {
                            const parts = currentPath.split("/");
                            parts.pop();
                            setCurrentPath(parts.join("/"));
                        }}
                        style={{ padding: "8px", cursor: "pointer", color: "var(--text-accent)" }}
                    >
                        📁 .. (наверх)
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
            
            <button style={{ marginTop: "15px", width: "100%" }} onClick={() => onSelect(currentPath)}>Выбрать эту папку</button>
        </div>
    );
};