import * as React from "react";
import { App } from "obsidian";
import { ReaderPage } from "./components/ReaderPage";
import { LibraryPage } from "./components/LibraryPage";
import MangaReaderPlugin from "./main"; // Импорт для типизации
import { TitlePage } from "./components/TitlePage";

// Обновляем описание того, что принимает интерфейс
interface InterfaceProps {
    app: App;
    plugin: MangaReaderPlugin;
}

// MangaInterface является чисто диспетчером
// он решает, какой компонент показать
export const MangaInterface = ({ app, plugin }: InterfaceProps) => {
    // Создаем локальный стейт для настроек, чтобы React видел изменения
    const [settings, setSettings] = React.useState(plugin.data.settings);

    // Теперь внутри этого компонента у нас есть доступ к:
    // plugin.data — наши настройки и прогресс
    // plugin.savePluginData() — функция сохранения

    // Храним информацию какие тайтл и глава сейчас выбраны
    const [selectedTitle, setSelectedTitle] = React.useState<string | null>(null);
    const [selectedChapter, setSelectedChapter] = React.useState<string | null>(null);
    
    // Функция для сохранения прогресса выбора главы
    const handleChapterChange = async (chapterName: string, resetPage: boolean = true) => {
        const titlePath = selectedTitle;
        if (!titlePath) return;

        // 1. Создаем запись в библиотеке, если её нет
        if (!plugin.data.library[titlePath]) {
            plugin.data.library[titlePath] = {
                lastChapter: "",
                lastPage: 1
            };
        }

        // 2. Обновляем данные в объекте
        plugin.data.library[titlePath].lastChapter = chapterName;
        if (resetPage) {
            plugin.data.library[titlePath].lastPage = 1;
        }

        // 3. Сначала сохраняем на диск
        await plugin.savePluginData();

        // 4. И только потом меняем состояние, чтобы переключить экран
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

    // Слушаем изменение настроек
    React.useEffect(() => {
        const handleUpdate = () => {
            // Принудительно обновляем стейт из данных плагина
            setSettings({ ...plugin.data.settings });
        };
        // Слушаем наше кастомное событие из main.ts
        // Используем приведение к any, чтобы разрешить кастомное имя события
        (plugin.app.workspace as any).on("manga-reader:settings-update", handleUpdate);
        
        return () => (plugin.app.workspace as any).off("manga-reader:settings-update", handleUpdate);
    }, [plugin]);

    // Диспетчер - что выбрали, туда и направит
    // Ридер с выбранной главой
    if (selectedChapter && selectedTitle) {
        return (
            <ReaderPage 
                app={app} 
                plugin={plugin}
                parentPath={selectedTitle} 
                chapterName={selectedChapter} 
                onBack={handleBack} 
                // Внутри ридера при переключении глав ВСЕГДА сбрасываем на стр. 1
                onChapterChange={(name) => handleChapterChange(name, true)}
            />
        );
    }

    // Витрина (TitlePage) со списком глав
    if (selectedTitle) {
        const chapterName = 'test_name'
        return (
            <div style={{ padding: "20px" }}>
                <TitlePage 
                    app={app}
                    plugin={plugin}
                    path={selectedTitle}
                    onBack={handleBack}
                    // Кнопка "Продолжить" — НЕ сбрасываем страницу
                    onContinue={(name) => handleChapterChange(name, false)}
                    // Клик по главе в списке — Сбрасываем на стр. 1
                    onSelectChapter={(name) => handleChapterChange(name, true)}
                />
            </div>
        );
    }

    // Если библиотека(LibraryPage)
    return (
        <div style={{ padding: "20px" }}>
            <LibraryPage 
                app={app} 
                plugin={plugin} // Передаем плагин здесь, чтобы наш LibraryPage мог с ней работать
                onSelectTitle={(path) => setSelectedTitle(path)} />
        </div>
    );
};