// Отступ для удобства построковой сверки

export const ru = {
    common: {
        back: "Назад",
        loading: "Загрузка...",
        save: "Сохранить",
        cancel: "Отмена",
        close: "Закрыть",
        doubleClick: "Двойной клик",
    },

    library: {
        title: "Моя Библиотека",
        addVaultFolder: "Указать папку Vault",
        addExternalFolder: "+ Внешняя папка",
        empty: "Библиотека пуста. Добавьте папки тайтлов в:",
        alternate: 'или выберите другую папку в настройках',
        externalLabel: "[Внешний]",
    },

    poster: {
        title: "Постер",
        image: "Изображение",
        settings: "Настройки",
        doubleClick: "Двойное нажатие - просмотр",
    },

    rating: {
        title: "Рейтинг",
        modalTitle: "Выставить рейтинг на:",
        ratingInfo: "Впишите или выставите рейтинг тайтла",
    },

    explorer: {
        mode: "Режим:",
        vaultMode: "Хранилище Obsidian",
        externalMode: "Диск (Desktop)",
        back: "📁 .. (наверх)",
        choose: "✅ Выбрать:",
        root: "Корень",
    },

    title: {
        continueReading: "Продолжить чтение",
        startReading: "Начать чтение",
        chapterList: "Список глав",
        nameChange: "Нажмите для смены названия",
        openNote: "Создать или открыть заметку",

        tabs: {
        description: "Описание",
        chapters: "Главы",
        comments: "Комментарии",
        },
    },
    chapterList: {
        empty: "Главы не найдены",
        chapter: "Глава",
        header: "Выберите главу",
    },

    reader: {
        nextChapter: "Следующая глава ➡",
        prevChapter: "⬅ Предыдущая глава",
        noImages: "Глава не содержит изображений",
        nextPage: "След. страница",
        prevPage: "Пред. страница",
        chapterCount: (current: number, total: number) =>
        `Глава ${current} из ${total}`,
        headerName: "Настройки читалки",
        header: {
            content: "Открыть оглавление",
            chapter: "Глава",
            settings: "Настройки",
        },
    },

    settings: {
        viewModeTitle: "Настройка режимов чтения",
        viewMode: "Режим чтения",
        viewModeDesc: "Выберите режим чтения",
        scroll: "Лента",
        singlePage: "Страница",
        indexWarmer: "Предзагрузка глав",
        indexWarmerDescription: "Соседние = ±1 главы, Расширенный = ±2 главы",
        adjacent: "Соседние",
        extended: "Расширенный",
        backgroundIndexing: "Фоновая индексация",
        backgroundIndexingDescription: "Индексировать все главы тайтла при открытии",
        gapBetweenPage: "Отступ между страницами",
        readerWidth: "Ширина читалки",

        settingsTitle: "Настройки читалки",
        language: "Язык",
        languageNotice: "Текущий язык изменен",
        lanDescription: "Выберите язык интерфейса",
        sourcesTitle: "Источники библиотеки",
        defaultPath: "Библиотека по умолчанию",
        currentDefaultPath: "Текущая:",
        noCurrent: "Папка не выбрана",
        selectDefaultFolder: "Выбрать папку",
        defaultFolderNotice: "Папка по умолчанию установлена на:",
        externalPath: "Внешние источники",
        currentExternalPath: "Добавлено внешних источников:",
        noExternalPath: "Внешние источники не добавлены",
        selectExternalFolder: "Добавить внешнюю папку",
        alreadyHas: "Этот путь уже добавлен",
        remove: "Удалить внешний источник",
        selectRemove: "Выберите источник для удаления",
        removeButton: "Удалить",
        removeNotice: "Удалено:",

        notesFolderTitle: "Папка для заметок по манге",
        notesFolderDesc: "",
        notesButtonText: "",
        notesFolderNotice: "Папка для заметок установлена на:",
        
        imageFolderTitle: "Папка для изображений по манге",
        imageFolderDesc: "",
        imageButtonText: "",
        imageFolderNotice: "Папка для изображений установлена на:",
    },

    note: {
        placeholder: "📝 Двойной клик, чтобы создать или открыть заметку",
        empty: "Заметка пуста. Двойной клик для редактирования.",
        descriptionEmpty: `Заметка есть, но заголовок "Описание" не найден`,
        commentsEmpty: `Заметка есть, но заголовок "Комментарии" не найден`,
        tagsEmpty: "Теги не указаны",
        headings: {
            description: "Описание",
            comments: "Комментарии"
        },
    },

    modal: {
        titleName: "Название тайтла",

        imageSelect: {
        headerName: "Выберите изображения",
        empty: "Нет изображений"
        },
    },
} as const;