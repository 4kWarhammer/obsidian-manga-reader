// Отступ для удобства построковой сверки

export const ru = {
    common: {
        back: "⬅ Назад",
        loading: "Загрузка...",
        save: "Сохранить",
        cancel: "Отмена",
        doubleClick: "Двойной клик",
    },

    library: {
        title: "Моя Библиотека",
        addVaultFolder: "Указать папку Vault",
        addExternalFolder: "+ Внешняя папка",
        empty: "Библиотека пуста. Добавьте папки в настройках выше.",
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
        modalTitle: "Выставить рейтинг",
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
    },

    reader: {
        nextChapter: "Следующая глава ➡",
        prevChapter: "⬅ Предыдущая глава",
        noImages: "Глава не содержит изображений",
        scrollMode: "Лента",
        singlePageMode: "Постранично",
        nextPage: "След. страница",
        prevPage: "Пред. страница",
        chapterCount: (current: number, total: number) =>
        `Глава ${current} из ${total}`,
    },

    note: {
        placeholder: "📝 Двойной клик, чтобы создать или открыть заметку",
        empty: "Заметка пуста. Двойной клик для редактирования.",
        descriptionEmpty: "Заметка есть, но заголовок «Описание» не найден",
        commentsEmpty: "Заметка есть, но заголовок «Комментарии» не найден",
        tagsEmpty: "Теги не указаны",
    },

    modal: {
        titleName: "Название тайтла",

        imageSelect: {
        headerName: "Выберите изображения",
        empty: "Нет изображений"
        },
    },
} as const;