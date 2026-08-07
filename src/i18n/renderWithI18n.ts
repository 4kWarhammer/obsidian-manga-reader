import * as React from "react";
import { I18nProvider } from "./I18nContext";
import type { Language } from "./index";


/**Используем для модалок с TSX компонентами
 * 
 * React компоненты используют свой хук для получения языка
 * Поэтому мы передаем отдельно комтекст для компонента
 */
export function renderWithI18n(
  element: React.ReactElement,
  language: Language | string | null | undefined
): React.ReactElement {
  return React.createElement(
    I18nProvider,
    { language, children: element }
  );
}