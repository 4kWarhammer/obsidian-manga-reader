import * as React from "react";
import { App } from "obsidian";
import { ReaderPage } from "./components/ReaderPage";
import { LibraryPage } from "./components/LibraryPage";
import MangaReaderPlugin from "./main"; // Импорт для типизации
import { TitlePage } from "./components/TitlePage";
import type { MangaViewState } from "./MangaView";

// Обновляем описание того, что принимает интерфейс
interface InterfaceProps {
    app: App;
    plugin: MangaReaderPlugin;
    selectedTitle: string | null;
    selectedChapter: string | null;
    navigate: (
        nextState: Partial<MangaViewState>,
        options?: { recordHistory?: boolean }
    ) => Promise<void>;
    goBackFromReader: () => void;
}

// MangaInterface является чисто диспетчером
// он решает, какой компонент показать
export const MangaInterface = ({
    app,
    plugin,
    selectedTitle,
    selectedChapter,
    navigate,
    goBackFromReader,
}: InterfaceProps) => {
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
        await plugin.saveSettings();

        // 4. И только потом меняем состояние, чтобы переключить экран
        await navigate({
            selectedChapter: chapterName,
        });
    };

    // Логика "Назад". Пока только для TitlePage
    // const handleBack = () => {
    //     if (selectedChapter) {
    //         goBackFromReader();
    //     }
    // };

    // Диспетчер - что выбрали, туда и направит
    // Ридер с выбранной главой
    if (selectedChapter && selectedTitle) {
        return (
            <ReaderPage 
                key={selectedChapter}
                app={app} 
                plugin={plugin}
                parentPath={selectedTitle} 
                chapterName={selectedChapter} 
                onBack={goBackFromReader} 
                // Внутри ридера при переключении глав ВСЕГДА сбрасываем на стр. 1
                onChapterChange={(name) => handleChapterChange(name, true)}
            />
        );
    }

    // Витрина (TitlePage) со списком глав
    if (selectedTitle) {
        return (
            <TitlePage 
                app={app}
                plugin={plugin}
                path={selectedTitle}
                // Кнопка "Продолжить" — НЕ сбрасываем страницу
                onContinue={(name) => handleChapterChange(name, false)}
                // Клик по главе в списке — Сбрасываем на стр. 1
                onSelectChapter={(name) => handleChapterChange(name, true)}
            />
        );
    }

    // Если библиотека(LibraryPage)
    return (
        <LibraryPage 
            app={app} 
            plugin={plugin}
            onSelectTitle={(path) =>
                navigate({
                    selectedTitle: path,
                    selectedChapter: null,
                })
            }
        />
    );
};