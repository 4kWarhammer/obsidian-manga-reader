import * as React from "react";
import type MangaReaderPlugin from "../main";
import { useProgressDebounce } from "src/hooks/useProgressDebounce";
import { logger } from "src/utils/logger";

/**
 * Хук сохранения прогресса чтения
 * сохраняет в plugin.data информацию о lastChapter, lastPage
 * @param debounceTime сбрасываемый таймер ожидания на сохранение
 * @returns flush, scheduleUpdate
 */
export function useReaderProgressSaver(
    plugin: MangaReaderPlugin,
    parentPath: string,
    debounceTime: number = 500
) {
    const onSaveCallback = React.useCallback(
        async (pageIdx: number, chapterName: string) => {
            const progress = plugin.data.library[parentPath];

            if (!progress) return;

            if (
                progress.lastChapter === chapterName &&
                progress.lastPage === pageIdx + 1
            ) {
                return;
            }

            progress.lastChapter = chapterName;
            progress.lastPage = pageIdx + 1;

            await plugin.saveProgress();

            logger.observer(
                `[Debounce] Saved: Chapter ${chapterName}, Page ${pageIdx + 1}`
            );
        },
        [parentPath, plugin]
    );

    return useProgressDebounce(onSaveCallback, debounceTime);
}