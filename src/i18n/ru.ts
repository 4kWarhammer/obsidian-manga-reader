// Отступ для удобства построковой сверки

export const ru = {
  common: {
    back: "⬅ Назад",
    loading: "Загрузка...",
    save: "Сохранить",
    cancel: "Отмена",
  },

  library: {
    title: "📚 Моя Библиотека",
    addVaultFolder: "Указать папку Vault",
    addExternalFolder: "+ Внешняя папка",
    empty: "Библиотека пуста. Добавьте папки в настройках выше.",
    externalLabel: "[Внешний]",
  },

  explorer: {
    mode: "Режим:",
    vaultMode: "Хранилище Obsidian",
    externalMode: "Диск (Desktop)",
    back: "📁 .. (наверх)",
    choose: "✅ Выбрать:",
    root: "Корень",
  },

  titlePage: {
    continueReading: "Продолжить чтение",
    startReading: "Начать чтение",
    chapterList: "Список глав",

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
    noImages: "В этой главе нет изображений",
    scrollMode: "Лента",
    singlePageMode: "Постранично",
    nextPage: "След. страница",
    prevPage: "Пред. страница",
    chapterCount: (current: number, total: number) =>
      `Глава ${current} из ${total}`,
  },

  note: {
    placeholder: "📝 Двойной клик, чтобы создать заметку",
    empty: "Заметка пуста. Двойной клик для редактирования.",
    descriptionEmpty: "Заметка есть, но заголовок «Описание» не найден",
    commentsEmpty: "Заметка есть, но заголовок «Комментарии» не найден",
    tagsEmpty: "Теги не указаны",
  },

  modal: {
    save: "Сохранить",
    cancel: "Отмена",
    selectImages: "Выбор изображений",
    empty: "Нет изображений",
  },
} as const;