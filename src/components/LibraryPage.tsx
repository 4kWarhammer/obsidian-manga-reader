import * as React from "react";
import { TFolder, TFile, TAbstractFile, App } from "obsidian";
import MangaReaderPlugin from "../main"; // Импорт для типа
import { FolderSelectModal } from "../modal/FolderSelectModal";

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавляем плагин в пропсы
    onSelectTitle: (path: string) => void; // Функция, которую мы вызовем при клике
}

// Страница библиотеки, тут происходит выбор пути до тайтла
export const LibraryPage = ({ app, plugin, onSelectTitle }: Props) => {
    // Храним текущую папку, в которой находимся
    const [defaultPath, setDefaultPath] = React.useState (plugin.data.defaultLibraryPath)
    const [items, setItems] = React.useState<TAbstractFile[]>([]);
    // const defaultPath = plugin.data.defaultLibraryPath;

    // Функция детектора манги - ВРОДЕ не нужна будет
    const isMangaFolder = (folder: TFolder): boolean => {
        return folder.children.some(f => 
            f instanceof TFolder || (f instanceof TFile && ['zip', 'cbz'].includes(f.extension))
        );
    };

    // Загружаем файлы из папки по умолчанию
    React.useEffect(() => {
        if (defaultPath) {
            const folder = app.vault.getAbstractFileByPath(defaultPath);
            if (folder instanceof TFolder) {
                setItems(folder.children);
            }
        }
    }, [defaultPath, app]);

    // Открываем модальное окно для пути по умолчанию
    const defaultFolderModal = () => {
        new FolderSelectModal(app, async (path) => {
            plugin.data.defaultLibraryPath = path;
            await plugin.savePluginData();
            // Чтобы React увидел изменения   plugin.data, нам нужно либо состояние, 
            // либо просто перезагрузить этот компонент. Для простоты:            
            setDefaultPath(path)
        }).open();
    };

    return (
        <div style={{ padding: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>📚 Моя библиотека</h2>
                <button onClick={defaultFolderModal}>⚙️ Настроить путь по умолчанию</button>
            </div>

            {defaultPath ? (
                <div style={{ marginTop: "20px" }}>
                    {/* <p style={{ fontSize: "0.8em", color: "var(--text-muted)" }}>Путь: {defaultPath}</p> */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {items.filter(i => i instanceof TFolder).map(item => (
                            <div 
                                key={item.path}
                                onClick={() => onSelectTitle(item.path)}
                                style={{ 
                                    padding: "15px", 
                                    background: "var(--background-secondary)", 
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    border: "1px solid var(--background-modifier-border)"
                                }}
                            >
                                📖 {item.name}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: "center", padding: "40px" }}>
                    <p>Установите папку по умолчанию</p>                    
                </div>
            )}
        </div>
    );
};
