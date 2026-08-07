import { ru } from "./ru";
import { en } from "./en";
import type { TranslationSchema } from "./types";

export const translations = {
  ru,
  en,
} satisfies Record<string, TranslationSchema>;

export type Language = keyof typeof translations;
export type Translation = TranslationSchema;

// Для не React компонентов используем обычные JS функции
// Но нужно ли все экспортировать...
export const fallbackLanguage: Language = "en";

export function isSupportedLanguage(language: unknown): language is Language {
  return (
    typeof language === "string" &&
    language in translations
  );
}

/** Простая проверка с Fallback на русский */
export function normalizeLanguage(language: unknown): Language {
  return isSupportedLanguage(language)
    ? language
    : fallbackLanguage;
}

export function getTranslation(language: unknown): Translation {
  return translations[normalizeLanguage(language)];
}

export { ru, en };
// Мы тут зачем еще раз экспортируем???
export type { TranslationSchema };