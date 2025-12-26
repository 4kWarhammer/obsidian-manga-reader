import * as React from "react";
import { TFolder, App } from "obsidian";
import MangaReaderPlugin from "../main"; // Импорт для типа

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавляем плагин в пропсы
    onSelectTitle: (path: string) => void; // Функция, которую мы вызовем при клике
}

// Страница библиотеки, тут происходит выбор пути до тайтла
export const LibraryPage = ({ app, plugin, onSelectTitle }: Props) => {
    const [folders, setFolders] = React.useState<string[]>([]);

    const scanLibrary = () => {
        const onlyFolders = app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map(f => f.path);
        setFolders(onlyFolders);
    };

    return (
        <div>
            <h2>📚 Библиотека</h2>
            <button onClick={scanLibrary}>Сканировать Vault</button>
            <div style={{ marginTop: "20px" }}>
                {folders.map(p => {
                    // Проверяем, есть ли прогресс для этой папки
                    const progress = plugin.data.library[p];
                    
                    return (
                        <div key={p} onClick={() => onSelectTitle(p)} style={{ 
                            cursor: "pointer", 
                            padding: "10px", 
                            borderBottom: "1px solid var(--background-modifier-border)",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            <div style={{ fontWeight: "bold" }}>📁 {p}</div>
                            {/* Если есть сохраненная глава — показываем её под названием */}
                            {progress && progress.lastChapter && (
                                <div style={{ fontSize: "0.8em", color: "var(--text-muted)", marginTop: "4px" }}>
                                    🔖 Последняя: {progress.lastChapter}
                                </div>                                  
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
