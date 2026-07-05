import * as React from "react";
import type MangaReaderPlugin from "../main";
import { useDebouncedCallback } from "./useDebouncedCallback";
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
): {
    scheduleUpdate: (pageIdx: number, chapterName: string) => void;
    flush: () => Promise<void>;
    cancel: () => void;
} {
    const saveProgress = React.useCallback(
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

    const {
        scheduleUpdate,
        flush,
        cancel,
    } = useDebouncedCallback(saveProgress, debounceTime);

    return {
        scheduleUpdate,
        flush,
        cancel,
    };
}