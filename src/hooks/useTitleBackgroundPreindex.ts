import * as React from "react";
import { App } from "obsidian";
import type MangaReaderPlugin from "../main";
import { createChapterIndexerOptions } from "src/utils/ChapterIndexHelpers";
import { logger } from "src/utils/logger";

export interface UseTitleBackgroundPreindexOptions {
    app: App;
    plugin: MangaReaderPlugin;
    parentPath: string;
    chapters: string[];
    enabled?: boolean;
}

export function useTitleBackgroundPreindex({
    app,
    plugin,
    parentPath,
    chapters,
    enabled = true,
}: UseTitleBackgroundPreindexOptions): void {
    const chaptersKey = React.useMemo(() => {
        return chapters.join("\u0000");
    }, [chapters]);

    React.useEffect(() => {
        if (!enabled) return;
        if (chapters.length === 0) return;

        let cancelled = false;

        const run = async () => {
            const indexManager = plugin.getChapterIndexManager();

            logger.virtualManager(
                `Title background preindex queued: ${chapters.length} chapters`
            );

            for (const chapterName of chapters) {
                if (cancelled) {
                    break;
                }

                try {
                    const opts = createChapterIndexerOptions({
                        app,
                        parentPath,
                        chapterName,
                    });

                    await indexManager.getOrBuildIndex(opts, 3);
                    logger.virtualManager(
                        `Title background preindex complete for: ${chapterName}`
                    );
                } catch (error) {
                    if (cancelled) {
                        break;
                    }

                    logger.error(
                        `Title background preindex failed for "${chapterName}"`,
                        error
                    );
                }

                /**
                 * Даём UI/event loop немного воздуха между главами.
                 * Особенно полезно на mobile.
                 */
                await delay(0);
            }

            if (cancelled) {
                logger.virtualManager(
                    `Title background preindex cancelled: ${parentPath}`
                );
            } else {
                logger.virtualManager(
                    `Title background preindex completed: ${parentPath}`
                );
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [
        app,
        plugin,
        parentPath,
        chaptersKey,
        enabled,
    ]);
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        window.setTimeout(resolve, ms);
    });
}