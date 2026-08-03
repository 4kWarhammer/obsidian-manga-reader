import { ru } from "./ru";

// Рекурсивный тип, который превращает конкретные строки-литералы в тип string,
// при этом бережно сохраняет функции и структуру объектов любой глубины.
type NormalizeTranslation<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K] // Если это функция (как chapterCount), оставляем её сигнатуру без изменений
    : T[K] extends string
    ? string
    : T[K] extends object
    ? NormalizeTranslation<T[K]> // Если это вложенный объект, идем глубже
    : T[K]; // Если это строка, превращаем её в общий тип string
};

// Экспортируем готовую схему на основе вашего русского файла
export type TranslationSchema = NormalizeTranslation<typeof ru>;