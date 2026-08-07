import * as React from "react";
import {
  fallbackLanguage,
  getTranslation,
  normalizeLanguage,
} from "./index";
import type { Language, Translation } from "./index";

type I18nContextValue = {
  language: Language;
  t: Translation;
};

const I18nContext = React.createContext<I18nContextValue>({
  language: fallbackLanguage,
  t: getTranslation(fallbackLanguage),
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
      t: getTranslation(normalizedLanguage),
    };
  }, [language]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return React.useContext(I18nContext);
}