import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "src/i18n/I18nContext";
import { App, TFolder, TFile } from "obsidian";
import { runWithConcurrency } from "src/utils/runWithConcurrency";
import * as Lucide from "lucide-react";
import { flushSync } from 'react-dom';

interface ImageFileInfo {
    path: string;
    name: string;
    folder: string;
    resourcePath: string;
}

interface FolderNode {
    folder: TFolder;
    name: string;
    files: ImageFileInfo[];
    children: FolderNode[];
}

interface Props {
    app: App;
    imagesFolder: string;
    selectedPaths: string[];
    onSave: (paths: string[]) => void;
    onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════
// ОПТИМИЗАЦИЯ 1: Предварительный расчёт статистики
// ═══════════════════════════════════════════════════════════════
// Вместо того чтобы считать getSubtreeFiles() для каждой папки
// при каждом рендере, считаем ОДИН РАЗ для всего дерева и
// сохраняем результаты в Map

interface FolderStats {
    totalFiles: number;      // Сколько всего файлов в папке и подпапках
    selectedFiles: number;   // Сколько из них выбрано
    allFilePaths: string[];  // Список всех путей (для чекбокса папки)
}

export const ImageSelectComponent = ({ 
    app, 
    imagesFolder, 
    selectedPaths: initialPaths, 
    onSave, 
    onClose
}: Props) => {
    const { t } = useI18n();
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(initialPaths));
    const [rootNode, setRootNode] = useState<FolderNode | null>(null);
    const [folderExpanded, setFolderExpanded] = useState<Map<string, boolean>>(new Map());

    // ═══════════════════════════════════════════════════════════════
    // Состояния для загрузки thumbnails
    // ═══════════════════════════════════════════════════════════════
    const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
    const [loadedFolders, setLoadedFolders] = useState<Set<string>>(new Set());

    useEffect(() => {
        collectImages();
    }, [imagesFolder]);

    const isImage = (ext: string): boolean => {
        return ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext.toLowerCase());
    };

    const buildNode = (folder: TFolder): FolderNode => {
        const node: FolderNode = {
            folder,
            name: folder.name,
            files: [],
            children: [],
        };

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                node.children.push(buildNode(child));
            } else if (child instanceof TFile && isImage(child.extension)) {
                node.files.push({
                    path: child.path,
                    name: child.name,
                    folder: folder.path,
                    resourcePath: app.vault.getResourcePath(child),
                });
            }
        }

        node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        return node;
    };

    // ═══════════════════════════════════════════════════════════════
    // Загрузка thumbnails с concurrency
    // ═══════════════════════════════════════════════════════════════
    const loadFolderImages = useCallback(async (node: FolderNode) => {
        // Проверяем что папка ещё не загружалась
        if (loadedFolders.has(node.folder.path)) {
            return;
        }

        // Помечаем папку как загружаемую
        setLoadedFolders(prev => new Set(prev).add(node.folder.path));

        // Берём только файлы из ЭТОЙ папки (не из подпапок)
        const folderFiles: TFile[] = [];
        for (const fileInfo of node.files) {
            const file = app.vault.getAbstractFileByPath(fileInfo.path);
            if (file instanceof TFile) {
                folderFiles.push(file);
            }
        }

        if (folderFiles.length === 0) return;

        // Загружаем изображения с concurrency = 5
        await runWithConcurrency(
            folderFiles,
            1, // одновременных загрузок
            async (file) => {
                return new Promise<string>((resolve) => {
                    const img = new Image();
                    const url = app.vault.getResourcePath(file);
                    img.onload = () => resolve(url);
                    img.onerror = () => resolve(url);
                    img.src = url;
                });
            },
            (index, resourcePath, file) => {
                // обновляет Dom каждый раз
                flushSync(() => {
                    setThumbnailUrls(prev => {
                        const newMap = new Map(prev);
                        newMap.set(file.path, resourcePath);
                        return newMap;
                    });
                });
            }
        );
    }, [app, loadedFolders]);

    const collectImages = useCallback(async () => {
        const folder = app.vault.getAbstractFileByPath(imagesFolder);
        if (!(folder instanceof TFolder)) return;
        
        const tree = buildNode(folder);
        setRootNode(tree);
    }, [app, imagesFolder]);

    useEffect(() => {
        // Загружаем файлы которые в корне (не в папках)
        if (rootNode && rootNode.files.length > 0) {
            loadFolderImages(rootNode);
        }
    }, [rootNode, loadFolderImages]);

    // ═══════════════════════════════════════════════════════════════
    // ОПТИМИЗАЦИЯ 1: useMemo для статистики папок
    // ═══════════════════════════════════════════════════════════════
    // Пересчитывается только когда меняется rootNode или selectedPaths
    // Вместо пересчёта при каждом рендере каждой папки
    
    const folderStatsMap = useMemo(() => {
        const statsMap = new Map<string, FolderStats>();
        
        if (!rootNode) return statsMap;

        // Рекурсивная функция для сбора статистики
        const calculateStats = (node: FolderNode): FolderStats => {
            // Собираем все файлы из текущей папки
            const allFilePaths = [...node.files.map(f => f.path)];
            
            // Добавляем файлы из всех подпапок
            for (const child of node.children) {
                const childStats = calculateStats(child);
                allFilePaths.push(...childStats.allFilePaths);
            }
            
            // Считаем сколько из них выбрано
            const selectedCount = allFilePaths.filter(path => selectedPaths.has(path)).length;
            
            const stats: FolderStats = {
                totalFiles: allFilePaths.length,
                selectedFiles: selectedCount,
                allFilePaths: allFilePaths
            };
            
            // Сохраняем в Map для быстрого доступа
            statsMap.set(node.folder.path, stats);
            
            return stats;
        };

        // Запускаем для всех корневых папок
        rootNode.children.forEach(child => calculateStats(child));
        
        return statsMap;
    }, [rootNode, selectedPaths]); // ← Пересчёт только при изменении этих значений

    const toggleFolder = useCallback((folderPath: string) => {
        setFolderExpanded(prev => {
            const newMap = new Map(prev);
            const willBeExpanded = !prev.get(folderPath);
            newMap.set(folderPath, willBeExpanded);
            
            // Если папка раскрывается - загружаем изображения
            if (willBeExpanded && rootNode) {
                // Находим FolderNode по пути
                const findNode = (node: FolderNode, path: string): FolderNode | null => {
                    if (node.folder.path === path) return node;
                    for (const child of node.children) {
                        const found = findNode(child, path);
                        if (found) return found;
                    }
                    return null;
                };

                // Ищем в корневых папках
                for (const child of rootNode.children) {
                    const node = findNode(child, folderPath);
                    if (node) {
                        // Запускаем загрузку в фоне с задержкой (не блокируем анимацию)
                        setTimeout(() => loadFolderImages(node), 100);
                        break;
                    }
                }
            }
            
            return newMap;
        });
    }, [rootNode, loadFolderImages]);

    const toggleFolderSelection = useCallback((folderPath: string, checked: boolean) => {
        const stats = folderStatsMap.get(folderPath);
        if (!stats) return;
        
        setSelectedPaths(prev => {
            const newSet = new Set(prev);
            for (const path of stats.allFilePaths) {
                if (checked) {
                    newSet.add(path);
                } else {
                    newSet.delete(path);
                }
            }
            return newSet;
        });
    }, [folderStatsMap]);

    const toggleFileSelection = useCallback((filePath: string) => {
        setSelectedPaths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(filePath)) {
                newSet.delete(filePath);
            } else {
                newSet.add(filePath);
            }
            return newSet;
        });
    }, []);

    const handleSave = () => {
        onSave(Array.from(selectedPaths));
        onClose();
    };

    // ═══════════════════════════════════════════════════════════════
    // ОПТИМИЗАЦИЯ 3: Ленивая загрузка изображений
    // ═══════════════════════════════════════════════════════════════
    
const renderFile = useCallback((file: ImageFileInfo, depth: number) => {
    const isChecked = selectedPaths.has(file.path);
    const imageUrl = thumbnailUrls.get(file.path); // Загружается если кеш есть, но thumbnail'а ещё нет

    return (
        <div 
            key={file.path} 
            className="image-item" 
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => toggleFileSelection(file.path)}
        >
            <input
                type="checkbox"
                checked={isChecked}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0 }}
            />
            
            {/* Показываем иконку-заглушку пока thumbnail грузится */}
            <div className="image-item-preview">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={file.name}
                        loading="lazy"
                    />
                ) : (
                    <div className="image-placeholder">
                        <Lucide.Image size={20} strokeWidth={1.5} />
                    </div>
                )}
            </div>
            
            <span>{file.name}</span>
        </div>
    );
}, [selectedPaths, toggleFileSelection, thumbnailUrls]);

    // ═══════════════════════════════════════════════════════════════
    // ОПТИМИЗАЦИЯ 4: Условный рендеринг вместо CSS-анимации
    // ═══════════════════════════════════════════════════════════════
    
    const renderFolderNode = useCallback((node: FolderNode, depth: number): React.ReactNode => {
        // Берём готовую статистику из Map (быстро!)
        const stats = folderStatsMap.get(node.folder.path);
        const allSelected = stats ? stats.selectedFiles === stats.totalFiles && stats.totalFiles > 0 : false;
        const someSelected = stats ? stats.selectedFiles > 0 && !allSelected : false;
        const expanded = folderExpanded.get(node.folder.path) ?? false;

        return (
            <div key={node.folder.path} className="image-select-folder">
                <div 
                    className="folder-header" 
                    style={{ paddingLeft: `${8 + depth * 16}px` }}
                    onClick={() => toggleFolder(node.folder.path)}
                >
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={(e) => toggleFolderSelection(node.folder.path, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ margin: 0 }}
                    />
                    <span 
                        className="folder-arrow"
                        // onClick={() => toggleFolder(node.folder.path)}
                    >
                        {expanded ? "▼" : "▶"}
                    </span>
                    <span 
                        className="folder-name"
                        // onClick={() => toggleFolder(node.folder.path)}
                    >
                        📁 {node.name}
                    </span>
                </div>

{/* 
                ВАЖНО: Контейнер всегда в DOM для плавной анимации
                CSS управляет видимостью через max-height/opacity
                */}
                <div className={`folder-content ${expanded ? 'expanded' : ''}`}>
                    {/* 
                        Внутреннее содержимое рендерится только когда нужно
                        Это экономит память и рендеринг изображений
                    */}
                    {expanded && (
                        <div className="folder-content-inner">
                            {node.children.map(child => renderFolderNode(child, depth + 1))}
                            {node.files.map(file => renderFile(file, depth + 1))}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [
        folderStatsMap, 
        folderExpanded, 
        toggleFolder, 
        toggleFolderSelection, 
        renderFile
    ]);

    const isEmpty = !rootNode || (rootNode.files.length === 0 && rootNode.children.length === 0);

    return (
        <>
            <h3>{t.modal.imageSelect.headerName}</h3>

            <div className="image-select-container">
                {isEmpty ? (
                    <div className="image-select-empty">{t.modal.imageSelect.empty}</div>
                ) : (
                    <>
                        {rootNode!.children.map(child => renderFolderNode(child, 0))}
                        {rootNode!.files.map(file => renderFile(file, 0))}
                    </>
                )}
            </div>

            <div className="modal-footer">
                <button className="mod-cta" onClick={handleSave}>
                    {t.common.save}
                </button>
                <button className="mod-cta" onClick={onClose}>
                    {t.common.cancel}
                </button>
            </div>
        </>
    );
};