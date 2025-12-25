import * as React from "react";
import { App } from "obsidian";
import { ReaderPage } from "./components/ReaderPage";
import { LibraryPage } from "./components/LibraryPage";
import { ChapterListPage } from "./components/ChapterListPage";



// MangaInterface является чисто диспетчером
// он решает, какой компонент показать
export const MangaInterface = ({ app }: { app: App }) => {
    // Храним информацию какие тайтл и глава сейчас выбраны
    const [selectedTitle, setSelectedTitle] = React.useState<string | null>(null);
    const [selectedChapter, setSelectedChapter] = React.useState<string | null>(null);
    
    // Логика "Назад" общая для всех компонентов
    const handleBack = () => {
        if (selectedChapter) {
            setSelectedChapter(null); // Если в главе — выходим к списку глав
        } else {
            setSelectedTitle(null);   // Если в списке глав — выходим в библиотеку
        }
    };

    // Диспетчер - что выбрали, туда и направит
    // Если конкретная глава манги    
    if (selectedChapter && selectedTitle) {
    return (
        <ReaderPage 
            app={app} 
            parentPath={selectedTitle} 
            chapterName={selectedChapter} 
            onBack={handleBack} 
        />
    );
}

    // Если тайтл??
    if (selectedTitle) {
        return (
            <div style={{ padding: "20px" }}>
                <ChapterListPage 
                    app={app} 
                    folderPath={selectedTitle} 
                    onBack={handleBack} 
                    onSelectChapter={(name) => setSelectedChapter(name)}
                />
            </div>
        );
    }

    // Тут как будто бы на страницу библиотеки??
    return (
        <div style={{ padding: "20px" }}>
            <LibraryPage app={app} onSelectTitle={(path) => setSelectedTitle(path)} />
        </div>
    );
};