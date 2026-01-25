import * as React from "react";
import { TFolder, TFile, TAbstractFile, App } from "obsidian";
import MangaReaderPlugin from "../main"; // Импорт для типа
import { FolderSelectModal } from "../modal/FolderSelectModal";
import { translations } from "src/i18n";

// Достаем Node.js модули
const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавляем плагин в пропсы
    onSelectTitle: (path: string) => void; // Функция, которую мы вызовем при клике
}

// Тип нашего "Тайтла" для библиотеки
interface LibraryItem {
    name: string;
    path: string;
    isExternal: boolean;
}

// Страница библиотеки, тут происходит выбор пути до тайтла
export const LibraryPage = ({ app, plugin, onSelectTitle }: Props) => {
    const currentLang = plugin.data.settings.language;
    const t = translations[currentLang || "en"];
    // const isDesktop = (window as any).require !== undefined; // уже не нужно
    // Создаем стейт для массива внешних путей
    const [externalPaths, setExternalPaths] = React.useState<string[]>(plugin.data.externalSources || []);
    // Храним папку по умолчанию, которую слушает плагин
    const [defaultPath, setDefaultPath] = React.useState (plugin.data.defaultLibraryPath)
    const [items, setItems] = React.useState<LibraryItem[]>([]); // Используем наш интерфейс

    // Функция детектора манги - ВРОДЕ не нужна будет
    const isMangaFolder = (folder: TFolder): boolean => {
        return folder.children.some(f => 
            f instanceof TFolder || (f instanceof TFile && ['zip', 'cbz'].includes(f.extension))
        );
    };

    // Функция для переключения языка
    const toggleLanguage = async () => {
        const newLang = currentLang === "ru" ? "en" : "ru";
        plugin.data.settings.language = newLang;
        await plugin.savePluginData(); 
        // Если ты внедрил шаг №2, страница обновится сама!
    };

    // Загружаем ссылки манги
    React.useEffect(() => {        
        const loadItems = async () => {
            let allItems: LibraryItem[] = [];

            // 1. Загружаем из папки по умолчанию (Vault)
            if (defaultPath) {
                const folder = app.vault.getAbstractFileByPath(defaultPath);
                if (folder instanceof TFolder) {
                    const vaultItems = folder.children
                        .filter(i => i instanceof TFolder)
                        .map(i => ({
                            name: i.name,
                            path: i.path,
                            isExternal: false
                        }));
                    allItems = [...allItems, ...vaultItems];
                }
            }

            // 2. Внешние источники (сканируем каждую добавленную папку)
            if (externalPaths.length > 0 && fs && pathModule) {
                for (const rootPath of externalPaths) {
                    try {
                        // Проверяем, существует ли путь
                        if (!fs.existsSync(rootPath)) continue;

                        const stats = fs.statSync(rootPath);
                        
                        if (stats.isDirectory()) {
                            // Читаем содержимое внешней КОРНЕВОЙ папки
                            const children = fs.readdirSync(rootPath, { withFileTypes: true });
                            
                            const extItems = children
                                .filter((child: any) => child.isDirectory())
                                .map((child: any) => ({
                                    name: child.name,
                                    path: pathModule.join(rootPath, child.name),
                                    isExternal: true
                                }));
                            
                            allItems = [...allItems, ...extItems];
                        }
                    } catch (e) {
                        console.error("Ошибка сканирования внешней папки:", rootPath, e);
                    }
                }
            }

            // Обновляем состояние (теперь setItems должен хранить объекты, а не TAbstractFile)
            setItems(allItems); 
        };

        loadItems();
    }, [defaultPath, externalPaths, app]);

    // Открываем модальное окно для пути по умолчанию
    const addDefaultFolderModal = () => {
        new FolderSelectModal(app, plugin ,async (path) => {
            plugin.data.defaultLibraryPath = path;
            await plugin.savePluginData();
            // Чтобы React увидел изменения plugin.data, нам нужно либо состояние, 
            // либо просто перезагрузить этот компонент. Для простоты:
            setDefaultPath(path)
        }, "vault").open();
    };

    // открываем модальное окно для внешних источников
    const addExternalFolderModal = () => {
        new FolderSelectModal(app, plugin, async (path) => {
            // Добавляем новый путь в массив, если его там еще нет
            if (!plugin.data.externalSources.includes(path)) {
                const newSources = [...plugin.data.externalSources, path];
                plugin.data.externalSources = newSources;
                await plugin.savePluginData();
                
                // Обновляем стейт, чтобы React перерисовал список
                setExternalPaths(newSources);
            }
        }, "external").open();
    };

    return (
        <div style={{ padding: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2>{t.libraryTitle}</h2>

                {/* Кнопка быстрого переключения языка */}
                <button onClick={toggleLanguage}>
                    {currentLang === "ru" ? "EN" : "RU"}
                </button>

                {/* добавляем папки */}
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={addDefaultFolderModal}>{t.addVaultFolder}</button>
                    {(window as any).require && (
                        <button onClick={addExternalFolderModal}>{t.addExternalFolder}</button>
                    )}
                </div>
            </div>

            {/* Тут отображаем список манги уже добавленной */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
                gap: "20px" 
            }}>
                {items.length > 0 ? items.map(item => (
                    <div 
                        key={item.path}
                        onClick={() => onSelectTitle(item.path)}
                        style={{ 
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                        }}
                    >
                        {/* Заготовка под обложку */}
                        <div style={{ 
                            aspectRatio: "2/3", 
                            background: "var(--background-secondary)", 
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid var(--background-modifier-border)",
                            fontSize: "2em",
                            transition: "transform 0.2s"
                        }}>
                            📖
                        </div>
                        
                        {/* Название */}
                        <div style={{ 
                            fontWeight: "bold", 
                            fontSize: "0.9em",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                        }}>
                            {item.name}
                        </div>
                        
                        {/* Метка внешнего источника (опционально, для отладки) */}
                        {item.isExternal && (
                            <div style={{ fontSize: "0.7em", color: "var(--text-muted)", textAlign: "center" }}>
                                [{t.externalLabel}]
                            </div>
                        )}
                    </div>
                )) : (
                    <p style={{ gridColumn: "1/-1", textAlign: "center", opacity: 0.5 }}>
                        {t.emptyLibrary}
                    </p>
                )}
            </div>
        </div>
    );
};
