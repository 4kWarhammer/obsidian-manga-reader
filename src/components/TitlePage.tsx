import * as React from "react";
import { App } from "obsidian";
import MangaReaderPlugin from "../main";
import { ChapterListPage } from "./ChapterListPage";

interface Props {
    app: App;
    plugin: MangaReaderPlugin;
    path: string;
    onBack: () => void;
    // Тут второй аргумент необязателен, поэтому ставим ?
    onContinue: (chapter: string, resetPage?: boolean) => void; // Для кнопки "Продолжить"
    onSelectChapter: (chapter: string, resetPage?: boolean) => void;
}

export const TitlePage = ({ app, plugin, path, onBack, onContinue, onSelectChapter }: Props) => {
    const progress = plugin.data.library[path];
    const titleName = path.split('/').pop();

    return (
        <div style={{ padding: "20px" }}>
            <button onClick={onBack}>⬅ Библиотека</button>
            
            <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
                <div style={{ width: "150px", height: "200px", background: "var(--background-secondary)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    🖼 Постер
                </div>
                <div>
                    <h1>{titleName}</h1>
                    {progress?.lastChapter ? (
                        <button 
                            style={{ background: "var(--interactive-accent)", color: "var(--text-on-accent)" }}
                            onClick={() => onContinue(progress.lastChapter, false)}
                        >
                            Продолжить: {progress.lastChapter} (стр. {progress.lastPage})
                        </button>
                    ) : (
                        <p>Вы еще не начали чтение</p>
                    )}
                </div>
            </div>

            <hr />

            {/* ВЫЗЫВАЕМ НАШ КОМПОНЕНТ ГЛАВ (ChapterListPage) */}
            <div style={{marginTop: "20px"}}>
                <h3>Список глав</h3>
                <ChapterListPage
                    app={app}
                    folderPath={path}
                    onBack={() => {}} // Передаем пустой? Потому что у TitlePage уже есть "Назад"
                    onSelectChapter={(name) => onSelectChapter(name, true)}
                />
            </div>            
        </div>
    );
};