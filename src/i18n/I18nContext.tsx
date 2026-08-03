import * as React from "react";
import { translations } from "./index";
import type { Language, Translation } from "./index";

type I18nContextValue = {
  language: Language;
  t: Translation;
};

const fallbackLanguage: Language = "ru";

function isSupportedLanguage(language: unknown): language is Language {
  return (
    typeof language === "string" &&
    language in translations
  );
}

function normalizeLanguage(language: unknown): Language {
  return isSupportedLanguage(language)
    ? language
    : fallbackLanguage;
}

const I18nContext = React.createContext<I18nContextValue>({
  language: fallbackLanguage,
  t: translations[fallbackLanguage],
});

type I18nProviderProps = {
  language: Language | string | null | undefined;
  children: React.ReactNode;
};

export function I18nProvider({ language, children }: I18nProviderProps) {
  const value = React.useMemo<I18nContextValue>(() => {
    const normalizedLanguage = normalizeLanguage(language);

    return {
      language: normalizedLanguage,
      t: translations[normalizedLanguage],
    };
  }, [language]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// Что то хитро, не понял как
export function useI18n(): I18nContextValue {
  return React.useContext(I18nContext);
}