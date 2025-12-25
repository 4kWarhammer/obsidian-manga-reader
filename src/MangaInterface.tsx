import * as React from "react";
import { App } from "obsidian";
import { LibraryPage } from "./components/LibraryPage";

export const MangaInterface = ({ app }: { app: App }) => {
    // Храним только то, какой тайтл сейчас выбран
    const [selectedTitle, setSelectedTitle] = React.useState<string | null>(null);

    // Если ничего не выбрано — показываем страницу библиотеки
    if (!selectedTitle) {
        return <LibraryPage app={app} onSelectTitle={(path) => setSelectedTitle(path)} />;
    }

    // Если тайтл выбран — пока просто пишем заглушку (потом заменим на ChapterListPage)
    return (
        <div style={{ padding: "20px" }}>
            <button onClick={() => setSelectedTitle(null)}>⬅ Назад</button>
            <h2>Выбрана манга: {selectedTitle}</h2>
        </div>
    );
};