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
        continue: "Продолжить чтение",
        noStartReading: "Начать чтение",
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
        notePlaceholder: "📝 Двойной клик, чтобы создать заметку",
        noteEmpty: "Заметка пуста. Двойной клик для редактирования.",
        noteDescriptionEmpty: "Заметка есть, но заголовок «Описание» не найден",
        noteCommentsEmpty: "Заметка есть, но заголовок «Комментарии» не найден",
        noteTagsEmpty: "Теги не указаны",
        // для таба в TitlePage
        tabDescription: "Описание",
        tabChapters: "Главы",
        tabComments: "Комментарии",
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
        continue: "Continue reading",
        noStartReading: "Start reading",
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
        notePlaceholder: "📝 Double-click to create a note",
        noteEmpty: "Note is empty. Double-click to edit.",
        noteDescriptionEmpty: "Note exists, but «Описание» heading not found",
        noteCommentsEmpty: "Note exists, but «Комментарии» heading not found",
        noteTagsEmpty: "No tags specified",
        // для таба в TitlePage
        tabDescription: "Description",
        tabChapters: "Chapters",
        tabComments: "Comments",
    }
};

export type Language = keyof typeof translations;