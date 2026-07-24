import * as React from "react";
import { TFolder, TFile, App } from "obsidian";
import MangaReaderPlugin from "../main";
import { FolderSelectModal } from "../modal/FolderSelectModal";
import { translations } from "src/i18n";
import { ImagePoster } from "./ImagePoster";
import { ImageSelectModal } from "../modal/ImageSelectModal";
import { createSmartClickHandler } from "src/utils/createSmartClickHandler";
import { ReadingProgressBar } from "./ReadingProgressBar";
import { getTitleDisplayName } from "src/utils/TitleUtils";

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
    chapterCount: number;
    lastChapterIndex?: number;
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

    // Функция для переключения языка
    const toggleLanguage = async () => {
        const newLang = currentLang === "ru" ? "en" : "ru";
        plugin.data.settings.language = newLang;
        await plugin.saveSettings();
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
                        .map(i => {
                            const titleFolder = i as TFolder;
                            const chapterNames = titleFolder.children
                                .filter(f => 
                                    f instanceof TFolder || 
                                    (f instanceof TFile && ['zip', 'cbz'].includes(f.extension))
                                )
                                .map(f => f.name)
                                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                            const progress = plugin.data.library[i.path];
                            const lastChapterIndex = progress?.lastChapter
                                ? chapterNames.findIndex(ch => ch === progress.lastChapter)
                                : -1;

                            return {
                                name: getTitleDisplayName(i.path, progress),
                                path: i.path,
                                isExternal: false,
                                chapterCount: chapterNames.length,
                                lastChapterIndex: lastChapterIndex >= 0 ? lastChapterIndex : undefined,
                            };
                        });
                    allItems = [...allItems, ...vaultItems];
                }
            }

            // 2. Внешние источники (сканируем каждую добавленную папку)
            if (externalPaths.length > 0 && fs && pathModule) {
                for (const rootPath of externalPaths) {
                    try {
                        if (!fs.existsSync(rootPath)) continue;
                        const stats = fs.statSync(rootPath);
                        
                        if (stats.isDirectory()) {
                            const children = fs.readdirSync(rootPath, { withFileTypes: true });
                            
                            const extItems = children
                                .filter((child: any) => child.isDirectory())
                                .map((child: any) => {
                                    const titlePath = pathModule.join(rootPath, child.name);
                                    
                                    let chapterNames: string[] = [];
                                    try {
                                        const titleFiles = fs.readdirSync(titlePath, { withFileTypes: true });
                                        chapterNames = titleFiles
                                            .filter((f: any) => 
                                                f.isDirectory() || 
                                                f.name.toLowerCase().endsWith(".zip") || 
                                                f.name.toLowerCase().endsWith(".cbz")
                                            )
                                            .map((f: any) => f.name)
                                            .sort((a: string, b: string) => 
                                                a.localeCompare(b, undefined, { numeric: true })
                                            );
                                    } catch {
                                        // ignore
                                    }

                                    const progress = plugin.data.library[titlePath];
                                    const lastChapterIndex = progress?.lastChapter
                                        ? chapterNames.findIndex((ch: string) => ch === progress.lastChapter)
                                        : -1;

                                    return {
                                        name: getTitleDisplayName(titlePath, progress),
                                        path: titlePath,
                                        isExternal: true,
                                        chapterCount: chapterNames.length,
                                        lastChapterIndex: lastChapterIndex >= 0 ? lastChapterIndex : undefined,
                                    };
                                });
                            
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
            await plugin.saveSettings();
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
                await plugin.saveSettings();
                
                // Обновляем стейт, чтобы React перерисовал список
                setExternalPaths(newSources);
            }
        }, "external").open();
    };

    const handlePosterDoubleClick = (itemPath: string) => {
        const posterImages = plugin.data.library[itemPath]?.posterImages || [];
        const onSave = (selected: string[]) => {
            if (!plugin.data.library[itemPath]) {
                plugin.data.library[itemPath] = { lastChapter: "", lastPage: 1 };
            }
            plugin.data.library[itemPath].posterImages = selected;
            plugin.saveProgress();
            setItems(prev => [...prev]);
        };
        new ImageSelectModal(
            app,
            plugin.data.settings.imagesFolder,
            posterImages,
            onSave
        ).open();
    };

    return (
        <div className = "library-main">
            <div className = "library-title">
                <h2>{t.libraryTitle}</h2>

                {/* Кнопка быстрого переключения языка */}
                <button onClick={toggleLanguage}>
                    {currentLang === "ru" ? "EN" : "RU"}
                </button>

                {/* Кнопка добавления источника */}
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={addDefaultFolderModal}>{t.addVaultFolder}</button>
                    {(window as any).require && (
                        <button onClick={addExternalFolderModal}>{t.addExternalFolder}</button>
                    )}
                </div>
            </div>

            {/* Тут отображаем список манги уже добавленной */}
            <div className = "title-grid">
                {items.length > 0 
                ? items.map(item => {
                    const handleSmartClick = createSmartClickHandler(
                        () => onSelectTitle(item.path),          // одиночный клик
                        () => handlePosterDoubleClick(item.path), // двойной клик
                        200,    // задержка, уменьшил
                    );

                    const current = item.lastChapterIndex !== undefined ? item.lastChapterIndex + 1 : 0;

                    return (
                        <div 
                            className="title"
                            key={item.path}
                            onClick={handleSmartClick}  // ← единый обработчик
                            style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: "8px" }}
                        >
                            <ImagePoster
                                app={app}
                                images={plugin.data.library[item.path]?.posterImages || []}
                                emptyPlaceholder={<span style={{ fontSize: "2em" }}>📖</span>}
                                // убрать onDoubleClick отсюда
                            />

                            <ReadingProgressBar
                                current={current}
                                total={item.chapterCount}
                                label={t.chapterCount(current, item.chapterCount)}
                            />

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
                    );
                }) 
                : (
                    <p style={{ gridColumn: "1/-1", textAlign: "center", opacity: 0.5 }}>
                        {t.emptyLibrary}
                    </p>
                )}
            </div>
        </div>
    );
};