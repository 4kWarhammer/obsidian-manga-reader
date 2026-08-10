import * as React from "react";
import * as Lucide from "lucide-react";
import { TFolder, TFile, App } from "obsidian";
import MangaReaderPlugin from "../main";
import { FolderSelectModal } from "../modal/FolderSelectModal";
import { translations } from "src/i18n";
import { useI18n } from "src/i18n/I18nContext";
import { ImagePoster } from "./ImagePoster";
import { ImageSelectModal } from "../modal/ImageSelectModal";
import { createSmartClickHandler } from "src/utils/createSmartClickHandler";
import { ReadingProgressBar } from "./ReadingProgressBar";
import { getTitleDisplayName } from "src/utils/TitleUtils";
import { parseRating } from "src/hooks/useTitleNote";
import { sanitizeFileName } from "src/utils/TitleUtils";
import { normalizePath } from "obsidian";

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
    rating?: number | null;
}

// Страница библиотеки, тут происходит выбор пути до тайтла
export const LibraryPage = ({ app, plugin, onSelectTitle }: Props) => {
    const currentLang = plugin.data.settings.language;
    // const t = translations[currentLang || "en"];
    const { t } = useI18n();
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

                            // --- рейтинг из заметки ---
                            const titleNameForNote = progress?.titleName || getTitleDisplayName(i.path, progress);
                            const noteFileName = `${sanitizeFileName(titleNameForNote)}.md`;
                            const noteFullPath = normalizePath(`${plugin.data.settings.notesFolder}/${noteFileName}`);
                            const noteFile = app.vault.getAbstractFileByPath(noteFullPath);
                            const rating = noteFile instanceof TFile
                                ? parseRating(app.metadataCache.getFileCache(noteFile)?.frontmatter?.rating)
                                : null;

                            return {
                                name: getTitleDisplayName(i.path, progress),
                                path: i.path,
                                isExternal: false,
                                chapterCount: chapterNames.length,
                                lastChapterIndex: lastChapterIndex >= 0 ? lastChapterIndex : undefined,
                                rating,
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

                                    const titleNameForNote = progress?.titleName || getTitleDisplayName(titlePath, progress);
                                    const noteFileName = `${sanitizeFileName(titleNameForNote)}.md`;
                                    const noteFullPath = normalizePath(`${plugin.data.settings.notesFolder}/${noteFileName}`);
                                    const noteFile = app.vault.getAbstractFileByPath(noteFullPath);
                                    const rating = noteFile instanceof TFile
                                        ? parseRating(app.metadataCache.getFileCache(noteFile)?.frontmatter?.rating)
                                        : null;

                                    return {
                                        name: getTitleDisplayName(titlePath, progress),
                                        path: titlePath,
                                        isExternal: true,
                                        chapterCount: chapterNames.length,
                                        lastChapterIndex: lastChapterIndex >= 0 ? lastChapterIndex : undefined,
                                        rating,
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

    return (
        <div className="library-main">
            <div className="library-title">
                <h1 className="title-header"> 
                    <Lucide.LibraryBig size={30} /> 
                    <span>{t.library.title}</span>
                </h1>

                <div style={{ display: "flex", gap: "10px" }}>
                    {/* Кнопка быстрого переключения языка */}
                    <button onClick={toggleLanguage}>
                        {currentLang === "ru" ? "RU" : "EN"}
                    </button>
                </div>
            </div>

            {/* Тут отображаем список манги уже добавленной */}
            <div className="title-grid">
                {items.length > 0 
                ? items.map(item => {
                    const current = item.lastChapterIndex !== undefined ? item.lastChapterIndex + 1 : 0;

                    return (
                        <div 
                            className="title"
                            key={item.path}
                            onClick={() => onSelectTitle(item.path)}
                        >
                            <div style={{ position: "relative" }}>
                                <ImagePoster
                                    app={app}
                                    images={plugin.data.library[item.path]?.posterImages || []}                                    
                                    showWidget={false}
                                />
                                {/* Как то не смотрится пока */}
                                {/* {item.rating !== null && item.rating !== undefined && (
                                    <div className="card-rating-badge">
                                        <TitleRating rating={item.rating} size="small" />
                                    </div>
                                )} */}
                            </div>

                            <ReadingProgressBar
                                current={current}
                                total={item.chapterCount}
                                label={t.reader.chapterCount(current, item.chapterCount)}
                            />

                            {/* Название */}
                            <div className="title-name">
                                {item.name}
                            </div>
                            
                            {/* Метка внешнего источника (опционально, для отладки) */}
                            {item.isExternal && (
                                <div className="is-external">
                                    [{t.library.externalLabel}]
                                </div>
                            )}
                        </div>
                    );
                }) 
                : (
                    <p className="empty-library">
                        {t.library.empty} {defaultPath} 
                        {t.library.alternate}
                    </p>
                )}
            </div>
        </div>
    );
};