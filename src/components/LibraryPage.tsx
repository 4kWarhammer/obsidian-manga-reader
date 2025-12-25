import * as React from "react";
import { TFolder, App } from "obsidian";

interface Props {
    app: App;
    onSelectTitle: (path: string) => void; // Функция, которую мы вызовем при клике
}

// Страница библиотеки, тут происходит выбор пути до тайтла
export const LibraryPage = ({ app, onSelectTitle }: Props) => {
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
                {folders.map(p => (
                    <div key={p} onClick={() => onSelectTitle(p)} style={{ 
                        cursor: "pointer", 
                        padding: "10px", 
                        borderBottom: "1px solid var(--background-modifier-border)" 
                    }}>
                        📁 {p}
                    </div>
                ))}
            </div>
        </div>
    );
};
