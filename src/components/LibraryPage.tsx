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

    // Функция сканирования на все папки в хранилище
    const scanLibrary = () => {
        const onlyFolders = app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder)
            .map(f => f.path);
        setFolders(onlyFolders);
    };

    return (
        <div style={{padding: "20px"}}>
            <h2>📚 Моя библиотека</h2>

            {/* Секция: В процессе чтения */}
            <div style={{marginBottom: "30px"}}>
                <h4 style={{ color: "var(--text-muted)" }}>Продолжить чтение</h4>
                {Object.keys(plugin.data.library).length > 0 ? (
                    Object.keys(plugin.data.library).map(path => (
                        <div key={path} onClick={() => onSelectTitle(path)} style={{ 
                            padding: "10px", 
                            background: "var(--background-secondary)",
                            marginBottom: "5px",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}>
                            <b>{path.split('/').pop()}</b>
                            <div style={{ fontSize: "0.8em" }}>
                                🔖 {plugin.data.library[path].lastChapter}
                            </div>
                        </div>
                    ))
                ) : (
                    <p style={{ fontSize: "0.8em" }}>Тут будет манга, которую вы начнете читать</p>
                )}

            </div>

            <hr />

            {/* СЕКЦИЯ: Все папки (сканирование) */}
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
