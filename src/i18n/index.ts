import { ru } from "./ru";
import { en } from "./en";
import type { TranslationSchema } from "./types";

export const translations = {
  ru,
  en,
} satisfies Record<string, TranslationSchema>;

export type Language = keyof typeof translations;
export type Translation = TranslationSchema;

export { ru, en };
// Мы тут зачем еще раз экспортируем???
export type { TranslationSchema };