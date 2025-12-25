import * as React from "react";
import { TFolder, App } from "obsidian";

interface Props {
    app: App;
    folderPath: string;      // Путь к папке манги
    onBack: () => void;      // Функция возврата назад
    onSelectChapter: (chapterName: string) => void; // Выбор главы для чтения
}

export const ChapterListPage = ({ app, folderPath, onBack, onSelectChapter }: Props) => {
    const [chapters, setChapters] = React.useState<string[]>([]);

    // Эффект загрузки: выполняется один раз при открытии компонента
    React.useEffect(() => {
        const folder = app.vault.getAbstractFileByPath(folderPath);
        
        if (folder instanceof TFolder) {
            const chapterFiles = folder.children
                .filter(f => f instanceof TFolder || f.name.endsWith('.zip') || f.name.endsWith('.cbz'))
                .map(f => f.name)
                // Сортировка: Глава 1, Глава 2, Глава 10...
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            
            setChapters(chapterFiles);
        }
    }, [app, folderPath]); // Если путь изменится, список обновится

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: "10px" }}>⬅ Назад к библиотеке</button>
            <h2>📖 {folderPath.split('/').pop()}</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {chapters.length > 0 ? (
                    chapters.map(name => (
                        <div 
                            key={name} 
                            onClick={() => onSelectChapter(name)}
                            style={{ 
                                padding: "12px", 
                                background: "var(--background-secondary)", 
                                borderRadius: "4px",
                                cursor: "pointer",
                                borderLeft: "4px solid var(--interactive-accent)"
                            }}
                        >
                            {name}
                        </div>
                    ))
                ) : (
                    <p>Главы не найдены</p>
                )}
            </div>
        </div>
    );
};