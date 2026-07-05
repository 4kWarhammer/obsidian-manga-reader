import * as React from "react";
import type MangaReaderPlugin from "../main";

/**
 * Фиксирует для дальнейшего использования стартовую страницу
 * Чтобы автосохранение не могло повлиять на остальные хуки
 */
export function useReaderInitialPage(
    plugin: MangaReaderPlugin,
    parentPath: string,
    chapterName: string
): number {
    const savedData = plugin.data.library[parentPath];

    const savedPage = (savedData && savedData.lastChapter === chapterName)
        ? Math.max(0, (savedData.lastPage || 1) - 1)
        : 0;

    const initialPageKey = `${parentPath}::${chapterName}`;

    const initialPageRef = React.useRef({
        key: initialPageKey,
        page: savedPage,
    });

    if (initialPageRef.current.key !== initialPageKey) {
        initialPageRef.current = {
            key: initialPageKey,
            page: savedPage,
        };
    }

    return initialPageRef.current.page;
}