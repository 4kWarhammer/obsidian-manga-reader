export const translations = {
    ru: {
        // Библиотек
        libraryTitle: "📚 Моя Библиотека",
        addVaultFolder: "Указать папку Vault",
        addExternalFolder: "+ Внешняя папка",
        emptyLibrary: "Библиотека пуста. Добавьте папки в настройках выше.",
        loading: "Распаковка и загрузка глав...",
        back: "⬅ Назад",
        externalLabel: "[Внешний]",
        // Папка проводника
        explorermode:"Режим:",
        vaultmode: "Хранилище Obsidian",
        extmode: "Диск (Desktop)",
        explorerback: "📁 .. (наверх)",
        explorerchoose: "✅ Выбрать:",
        explorerroot: "Корень",
        // Витрина
        continue: (lastchapter: string, lastpage: number) => `Продолжить: ${lastchapter} стр. ${lastpage}`,
        noStartReading: "Вы еще не начали чтение",
        chapterList: "Список глав",
        // Главы
        nochapters: "Главы не найдены",
        // Читалка
        isloading: "Загрузка...",
        nextChapter: "Следующая глава ➡",
        prevChapter: "⬅ Предыдущая глава",
        chapterCount: (current: number, total: number) => `Глава ${current} из ${total}`,
        noImages: "В этой главе нет изображений",
        scrollMode: "Лента",
        singlePageMode: "Постранично",
        nextPage: "След. страница",
        prevPage: "Пред. страница",
        

    },
    en: {
        // Библиотека
        libraryTitle: "📚 My Library",
        addVaultFolder: "Select Vault Folder",
        addExternalFolder: "+ External Folder",
        emptyLibrary: "Library is empty. Add folders in settings above.",
        loading: "Unpacking and loading chapters...",
        back: "⬅ Back",
        externalLabel: "[External]",
        // Папка проводника
        explorermode:"Mode:",
        vaultmode: "Obsidian's Vault",
        extmode: "Disk (Desktop)",
        explorerback: "📁 .. (up)",
        explorerchoose: "✅ Choose:",
        explorerroot: "Root",
        // Витрина
        continue: (lastchapter: string, lastpage: number) => `Continue: ${lastchapter} p. ${lastpage}`,
        noStartReading: "You haven't start reading yet",
        chapterList: "Chapter list",
        // Главы
        nochapters: "Chapters not found",
        // Читалка
        isloading: "Loading...",
        nextChapter: "Next Chapter ➡",
        prevChapter: "⬅ Previous Chapter",
        chapterCount: (current: number, total: number) => `Chapter ${current} of ${total}`,
        noImages: "No images in this chapter",
        scrollMode: "Feed",
        singlePageMode: "Page-by-page",
        nextPage: "Next page",
        prevPage: "Prev. page",
        
    }
};

export type Language = keyof typeof translations;