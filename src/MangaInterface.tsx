import * as React from "react";
import { App } from "obsidian";
import { ReaderPage } from "./components/ReaderPage";
import { LibraryPage } from "./components/LibraryPage";
import { ChapterListPage } from "./components/ChapterListPage";
import MangaReaderPlugin from "./main"; // Импорт для типизации

// Обновляем описание того, что принимает интерфейс
interface InterfaceProps {
    app: any;
    plugin: MangaReaderPlugin;
}

// MangaInterface является чисто диспетчером
// он решает, какой компонент показать
export const MangaInterface = ({ app, plugin }: InterfaceProps) => {
    // Теперь внутри этого компонента у нас есть доступ к:
    // plugin.data — наши настройки и прогресс
    // plugin.savePluginData() — функция сохранения

    // Храним информацию какие тайтл и глава сейчас выбраны
    const [selectedTitle, setSelectedTitle] = React.useState<string | null>(null);
    const [selectedChapter, setSelectedChapter] = React.useState<string | null>(null);
    
    // Функция для сохранения прогресса выбора главы
    const updateLastChapter = async (titlePath: string, chapterName: string) => {
        // Проверяем, есть ли уже запись для этой манги, если нет - создаем пустой объект
        if (!plugin.data.library[titlePath]) {
            plugin.data.library[titlePath] = {
                lastChapter: "",
                lastPage: 0
            };
        }

        // Обновляем данные
        plugin.data.library[titlePath].lastChapter = chapterName;
        
        
        // Сохраняем на диск (в data.json)
        await plugin.savePluginData();
        
        // Теперь обновляем состояние React, чтобы открылся ридер
        setSelectedChapter(chapterName);
    };

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
            plugin={plugin}
            parentPath={selectedTitle} 
            chapterName={selectedChapter} 
            onBack={handleBack} 
            // Сюда в будущем передадим функцию сохранения страницы
        />
    );
}

    // Если тайтл со списком глав
    if (selectedTitle) {
        return (
            <div style={{ padding: "20px" }}>
                <ChapterListPage 
                    app={app} 
                    folderPath={selectedTitle} 
                    onBack={handleBack} 
                    // onSelectChapter={(name) => setSelectedChapter(name)}
                    onSelectChapter={(name) => updateLastChapter(selectedTitle, name)}
                />
            </div>
        );
    }

    // Тут как будто бы на страницу библиотеки
    return (
        <div style={{ padding: "20px" }}>
            <LibraryPage 
            app={app} 
            plugin={plugin} // Передаем плагин здесь, чтобы наш LibraryPage мог с ней работать
            onSelectTitle={(path) => setSelectedTitle(path)} />
        </div>
    );
};