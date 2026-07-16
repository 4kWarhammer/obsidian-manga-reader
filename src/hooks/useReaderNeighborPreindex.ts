import * as React from "react";
import { App } from "obsidian";
import type MangaReaderPlugin from "src/main";
import { createChapterIndexerOptions } from "src/utils/ChapterIndexHelpers";
import { IndexPriority } from "src/utils/ChapterIndexManager";
import { logger } from "src/utils/logger";

// Пока типы тут оставлю - они специфичные
export type ReaderPreindexMode = 'adjacent' | 'extended';

// Будем делать:
// adjacent:
//   next + previous priority 1

// extended:
//   next + previous priority 1
//   nextNext + previousPrevious priority 2


interface UseReaderNeighborPreindexOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    allChapters: string[];
    activeChapterName: string | null;
    mode: ReaderPreindexMode;
    enabled?: boolean;
}

/**
 * Index Warmer - Ставит в ChapterIndexManager 
 * фоновые задачи индексации вокруг активной главы.
 *
 * adjacent:
 *   previous / next -> priority 1
 *
 * extended:
 *   previous / next -> priority 1
 *   previousPrevious / nextNext -> priority 2
 *
 * Хук не строит layout и не грузит изображения.
 * Он только прогревает metadata index.
 */
export function useReaderNeighborPreindex({
    app,
    plugin,
    parentPath,
    allChapters,
    activeChapterName,
    mode,
    enabled = true,
}: UseReaderNeighborPreindexOptions): void {
    const lastPreindexKeyRef = React.useRef<string | null>(null);

    const allChaptersKey = React.useMemo(() => {
        return allChapters.join("\u0000");
    }, [allChapters]);

    React.useEffect(() => {
        if (!enabled) return;
        if (!activeChapterName) return;
        if (allChapters.length === 0) return;

        const activeCapterIndex = allChapters.indexOf(activeChapterName);

        if (activeCapterIndex === -1) {
            logger.virtualManager(
                `Neighbor preindex skipped: active chapter "${activeChapterName}" not found`
            );
            return;
        }

        const preindexKey = `${parentPath}::${activeChapterName}::${mode}::${allChaptersKey}`;

        if (lastPreindexKeyRef.current === preindexKey) {
            return;
        }

        lastPreindexKeyRef.current = preindexKey;

        const tasks = buildNeighborTasks(
            allChapters,
            activeCapterIndex,
            mode
        );

        if (tasks.length === 0) {
            return;
        }

        const indexManager = plugin.getChapterIndexManager();

        logger.virtualManager(
            `Neighbor preindex for "${activeChapterName}": ${tasks
                .map(task => `${task.chapterName}(priority${task.priority})`)
                .join(", ")}`
        );

        for (const task of tasks) {
            const opts = createChapterIndexerOptions({
                app,
                parentPath,
                chapterName: task.chapterName,
            });

            indexManager
                .getOrBuildIndex(opts, task.priority)
                .catch(error => {
                    logger.error(
                        `Neighbor preindex failed for "${task.chapterName}"`,
                        error
                    );
                });
        }
    }, [
        app,
        plugin,
        parentPath,
        allChaptersKey,
        activeChapterName,
        mode,
        enabled,
    ]);
}

interface NeighborPreindexTask {
    chapterName: string;
    priority: IndexPriority;
}

function buildNeighborTasks(
    allChapters: string[],
    activeIndex: number,
    mode: ReaderPreindexMode
): NeighborPreindexTask[] {
    const tasks: NeighborPreindexTask[] = [];

    const previous = allChapters[activeIndex - 1];
    const next = allChapters[activeIndex + 1];

    if (next) {
        tasks.push({
            chapterName: next,
            priority: 1,
        });
    }

    if (previous) {
        tasks.push({
            chapterName: previous,
            priority: 1,
        });
    }

    if (mode === "extended") {
        const nextNext = allChapters[activeIndex + 2];
        const previousPrevious = allChapters[activeIndex - 2];

        if (nextNext) {
            tasks.push({
                chapterName: nextNext,
                priority: 2,
            });
        }

        if (previousPrevious) {
            tasks.push({
                chapterName: previousPrevious,
                priority: 2,
            });
        }
    }

    return tasks;
}