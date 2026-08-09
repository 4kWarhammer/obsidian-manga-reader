import * as React from "react";
import { useState, useEffect } from "react";
import { useI18n } from "src/i18n/I18nContext";
import { App, TFolder, TFile } from "obsidian";

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

    const collectImages = () => {
        const folder = app.vault.getAbstractFileByPath(imagesFolder);
        if (!(folder instanceof TFolder)) return;
        setRootNode(buildNode(folder));
    };

    const getSubtreeFiles = (node: FolderNode): ImageFileInfo[] => {
        const result = [...node.files];
        for (const child of node.children) {
            result.push(...getSubtreeFiles(child));
        }
        return result;
    };

    const toggleFolder = (folderPath: string) => {
        setFolderExpanded(prev => {
            const newMap = new Map(prev);
            newMap.set(folderPath, !prev.get(folderPath));
            return newMap;
        });
    };

    const toggleFolderSelection = (node: FolderNode, checked: boolean) => {
        const subtreeFiles = getSubtreeFiles(node);
        setSelectedPaths(prev => {
            const newSet = new Set(prev);
            for (const file of subtreeFiles) {
                if (checked) newSet.add(file.path);
                else newSet.delete(file.path);
            }
            return newSet;
        });
    };

    const toggleFileSelection = (filePath: string) => {
        setSelectedPaths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(filePath)) {
                newSet.delete(filePath);
            } else {
                newSet.add(filePath);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        onSave(Array.from(selectedPaths));
        onClose();
    };

    const renderFile = (file: ImageFileInfo, depth: number) => {
        const isChecked = selectedPaths.has(file.path);
        return (
            <div 
                key={file.path} 
                className="image-item" 
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFileSelection(file.path)}
                    style={{ margin: 0 }}
                />
                <img src={file.resourcePath} alt={file.name} />
                <span>{file.name}</span>
            </div>
        );
    };

    const renderFolderNode = (node: FolderNode, depth: number): React.ReactNode => {
        const subtreeFiles = getSubtreeFiles(node);
        const allSelected = subtreeFiles.length > 0 && subtreeFiles.every(f => selectedPaths.has(f.path));
        const someSelected = subtreeFiles.some(f => selectedPaths.has(f.path));
        const expanded = folderExpanded.get(node.folder.path) ?? false;

        return (
            <div key={node.folder.path} className="image-select-folder">
                <div 
                    className="folder-header" 
                    style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={(e) => toggleFolderSelection(node, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ margin: 0 }}
                    />
                    <span 
                        className="folder-arrow"
                        onClick={() => toggleFolder(node.folder.path)}
                    >
                        {expanded ? "▼" : "▶"}
                    </span>
                    <span 
                        className="folder-name"
                        onClick={() => toggleFolder(node.folder.path)}
                    >
                        📁 {node.name}
                    </span>
                </div>

                <div className={`folder-content ${expanded ? 'expanded' : ''}`}>
                    <div className="folder-content-inner">
                        {node.children.map(child => renderFolderNode(child, depth + 1))}
                        {node.files.map(file => renderFile(file, depth + 1))}
                    </div>
                </div>
            </div>
        );
    };

    const isEmpty = !rootNode || (rootNode.files.length === 0 && rootNode.children.length === 0);

    return (
        <>
            {/*  */}
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