// Заметка: двойной расчет сигнатуры, сначала в getOrBuildIndex
// Потом в runTask this.indexer.index
// Нужно будет или передавать, или сделать ChapterSignatureBuilder

import { CachedChapterIndex } from 'src/types';
import {
    ChapterIndexerOptions,
    ChapterIndexerProgress,
} from 'src/utils/indexTypes';
import { ChapterIndexCache } from 'src/utils/ChapterIndexCache';
import { ChapterIndexer } from 'src/utils/ChapterIndexer';
import { logger } from 'src/utils/logger';

export type IndexPriority = 0 | 1 | 2 | 3;

type DirectionHint = 'previous' | 'next' | 'both';

interface IndexQueueItem {
    opts: ChapterIndexerOptions;
    priority: IndexPriority;
    sequence: number;
    onProgress?: (progress: ChapterIndexerProgress) => void;
    resolve: (index: CachedChapterIndex) => void;
    reject: (error: unknown) => void;
}

export interface PreindexTitleOptions {
    includeCurrent?: boolean;
    priority?: IndexPriority;
}

export class ChapterIndexManager {
    private cache: ChapterIndexCache;
    private indexer: ChapterIndexer;

    /**
     * Защита от запуска ChapterIndexManager без ChapterIndexCache
     * 
     * Базово, лучше делать это извне, для более явного lifeCycle
     * Но сделаю возможность "глупого запуска"
     */
    private cacheLoadPromise: Promise<void> | null = null;

    /**
     * Очередь задач на индексацию.
     *
     * В очередь попадают только cache miss задачи.
     * Cache hit возвращается сразу и в очередь не добавляется.
     */
    private queue: IndexQueueItem[] = [];

    /**
     * Карта уже запущенных или ожидающих задач.
     *
     * chapterKey -> Promise<CachedChapterIndex>
     *
     * Нужна, чтобы два параллельных вызова getOrBuildIndex()
     * для одной главы не запускали две индексации.
     */
    private inFlight = new Map<string, Promise<CachedChapterIndex>>();

    /**
     * Флаг, что queue worker уже запущен.
     *
     * Нужен, чтобы каждый вызов getOrBuildIndex()
     * не создавал новый независимый цикл обработки очереди.
     */
    private isDraining = false;

    /**
     * Счётчик добавления задач.
     *
     * Нужен для стабильного порядка внутри одинакового priority.
     * Если две задачи имеют priority 3, первой выполнится та,
     * которая раньше была добавлена.
     */
    private nextSequence = 0;

    /**
     * Текущая активная глава.
     *
     * Используется только для preindexTitle/preindexNeighbors,
     * чтобы не ставить текущую главу в фон с низким priority.
     */
    private currentChapterKey: string | null = null;

    constructor(cache: ChapterIndexCache, indexer = new ChapterIndexer()) {
        this.cache = cache;
        this.indexer = indexer;
    }

    // ============================================================
    // Основной публичный метод
    // ============================================================

    /**
     * Получить индекс главы из кэша или построить его.
     *
     * Логика:
     * 1. Если такая глава уже индексируется или стоит в очереди —
     *    возвращаем существующий Promise.
     * 2. Считаем свежую сигнатуру источника.
     * 3. Проверяем persistent cache.
     * 4. Если cache hit — возвращаем CachedChapterIndex сразу.
     * 5. Если cache miss — добавляем задачу в priority queue.
     */
    async getOrBuildIndex(
        opts: ChapterIndexerOptions,
        priority: IndexPriority = 3,
        onProgress?: (progress: ChapterIndexerProgress) => void
    ): Promise<CachedChapterIndex> {
        // Убеждаемся, что ChapterImageCache загружен
        await this.ensureCacheLoaded();
        // Проверяем есть ли глава в promise запущеный задач
        const existing = this.inFlight.get(opts.chapterKey);

        // Поднимаем в очереди и возвращаем promise из inFlight
        // Для случая, когда глава уже была в очереди (допустим background - 3)
        // Пользователь перешел в эту главу - теперь она с приоритетом 0
        if (existing) {
            this.promoteInQueue(opts.chapterKey, priority);
            logger.lazyLoader(
                `ChapterIndexManager: reuse in-flight index task for "${opts.chapterName}"`
            );
            return existing;
        }

        // Высчитываем сигнатуру индексером
        // Это "Как сейчас выглядит источник главы на диске?"
        const signature = await this.indexer.computeSignature(opts);

        // Сверяем сигнатуру с кэшем
        if (this.cache.hasValidChapter(opts.chapterKey, signature)) {
            const cached = this.cache.getChapter(opts.chapterKey);

            if (cached) {
                logger.lazyLoader(
                    `ChapterIndexManager: cache hit for "${opts.chapterName}"`
                );
                // После проверки быстрый выход, сразу возвращает CachedChapterIndex
                return cached;
            }
        }

        // От race condition. Перепроверяем this.inFlight.get(opts.chapterKey) после 
        // const signature = await this.indexer.computeSignature(opts)
        const existingAfterSignature = this.inFlight.get(opts.chapterKey);

        // Ну и делаем promote если оказалось, что уже есть
        if (existingAfterSignature) {
            this.promoteInQueue(opts.chapterKey, priority);
            logger.lazyLoader(
                `ChapterIndexManager: reuse in-flight index task for "${opts.chapterName}" after signature check`
            );
            return existingAfterSignature;
        }

        logger.lazyLoader(
            `ChapterIndexManager: cache miss for "${opts.chapterName}", priority ${priority}`
        );
        // Создаётся Promise и задача добавляется в очередь.
        // Важно: enqueue не выполняет индексацию сам, только кладет в очередь
        const promise = this.enqueue(opts, priority, onProgress);
        this.inFlight.set(opts.chapterKey, promise);

        promise.then(
            () => this.inFlight.delete(opts.chapterKey),
            () => this.inFlight.delete(opts.chapterKey)
        );

        // Запуск обработки очереди
        this.drainQueue();

        return promise;
    }

    // ============================================================
    // Текущая глава
    // ============================================================

    /**
     * Сообщает менеджеру, какая глава сейчас активная.
     *
     * Сам по себе этот метод не запускает индексацию.
     * Он только сохраняет currentChapterKey, чтобы фоновые методы
     * могли правильно расставлять приоритеты.
     */
    setCurrentChapter(chapterKey: string): void {
        if (this.currentChapterKey === chapterKey) {
            return;
        }

        this.currentChapterKey = chapterKey;

        logger.lazyLoader(
            `ChapterIndexManager: current chapter set to "${chapterKey}"`
        );
    }

    getCurrentChapter(): string | null {
        return this.currentChapterKey;
    }

    // ============================================================
    // Фоновая индексация соседей
    // ============================================================

    /**
     * Поставить в очередь соседние главы.
     *
     * Ожидает полный список opts для глав в порядке чтения.
     *
     * Приоритеты:
     * - immediate previous/next: priority 1
     * - near previous/next через одну главу: priority 2
     *
     * directionHint позволяет сначала поставить более вероятное направление.
     */
    preindexNeighbors(
        chapters: ChapterIndexerOptions[],
        currentChapterKey: string,
        directionHint: DirectionHint = 'both'
    ): void {
        this.setCurrentChapter(currentChapterKey);

        const currentIndex = chapters.findIndex(
            chapter => chapter.chapterKey === currentChapterKey
        );

        if (currentIndex === -1) {
            logger.lazyLoader(
                `ChapterIndexManager: cannot preindex neighbors, current chapter not found "${currentChapterKey}"`
            );
            return;
        }

        const previous = chapters[currentIndex - 1];
        const next = chapters[currentIndex + 1];

        const previousNear = chapters[currentIndex - 2];
        const nextNear = chapters[currentIndex + 2];

        const tasks: Array<{
            opts: ChapterIndexerOptions | undefined;
            priority: IndexPriority;
        }> = [];

        // При одинаковом priority порядок задаётся sequence/FIFO:
        // next попадёт в очередь раньше previous и будет выбран первым.
        if (directionHint === 'next') {
            tasks.push(
                { opts: next, priority: 1 },
                { opts: previous, priority: 1 },
                { opts: nextNear, priority: 2 },
                { opts: previousNear, priority: 2 }
            );
        } else if (directionHint === 'previous') {
            tasks.push(
                { opts: previous, priority: 1 },
                { opts: next, priority: 1 },
                { opts: previousNear, priority: 2 },
                { opts: nextNear, priority: 2 }
            );
        } else {
            tasks.push(
                { opts: previous, priority: 1 },
                { opts: next, priority: 1 },
                { opts: previousNear, priority: 2 },
                { opts: nextNear, priority: 2 }
            );
        }

        for (const task of tasks) {
            if (!task.opts) continue;

            this.getOrBuildIndex(task.opts, task.priority).catch(error => {
                logger.error(
                    `ChapterIndexManager: neighbor preindex failed for "${task.opts?.chapterName}"`,
                    error
                );
            });
        }
    }

    // ============================================================
    // Фоновая индексация всего тайтла
    // ============================================================

    /**
     * Поставить весь тайтл в фоновую индексацию.
     *
     * По умолчанию текущая глава пропускается, потому что она обычно
     * должна индексироваться отдельно с priority 0.
     */
    preindexTitle(
        chapters: ChapterIndexerOptions[],
        options: PreindexTitleOptions = {}
    ): void {
        const includeCurrent = options.includeCurrent ?? false;
        const priority = options.priority ?? 3;

        logger.lazyLoader(
            `ChapterIndexManager: preindexTitle queued ${chapters.length} chapters`
        );

        for (const chapter of chapters) {
            if (!includeCurrent && chapter.chapterKey === this.currentChapterKey) {
                continue;
            }

            this.getOrBuildIndex(chapter, priority).catch(error => {
                logger.error(
                    `ChapterIndexManager: title preindex failed for "${chapter.chapterName}"`,
                    error
                );
            });
        }
    }

    // ============================================================
    // Очередь
    // ============================================================

    /**
     * Добавляет задачу в очередь и возвращает Promise,
     * который будет resolved/rejected внутри drainQueue().
     */
    private enqueue(
        opts: ChapterIndexerOptions,
        priority: IndexPriority,
        onProgress?: (progress: ChapterIndexerProgress) => void
    ): Promise<CachedChapterIndex> {
        return new Promise<CachedChapterIndex>((resolve, reject) => {
            this.queue.push({
                opts,
                priority,
                sequence: this.nextSequence++,
                onProgress,
                resolve,
                reject,
            });
        });
    }

    /**
     * Основной worker очереди.
     *
     * Работает последовательно:
     * - берёт задачу с самым высоким приоритетом;
     * - индексирует главу через ChapterIndexer;
     * - сохраняет результат в ChapterIndexCache;
     * - сохраняет cache на диск;
     * - resolve/reject соответствующего Promise.
     */
    private async drainQueue(): Promise<void> {
        if (this.isDraining) return;

        this.isDraining = true;

        try {
            while (this.queue.length > 0) {
                const task = this.takeNextTask();

                if (!task) break;

                await this.runTask(task);
            }
        } finally {
            this.isDraining = false;

            //  Защита от race condition:
            //  Если новая задача была добавлена между выходом из while
            //  и установкой isDraining = false, нужно снова запустить drain.
            if (this.queue.length > 0) {
                this.drainQueue();
            }
        }
    }

    /**
     * Просто выбирает следующую задачу из очереди.
     *
     * Чем меньше priority, тем важнее задача:
     * 0 — текущая глава;
     * 1 — непосредственные соседи;
     * 2 — ближние соседи;
     * 3 — дальний фон.
     *
     * При равном priority используется sequence.
     */
    private takeNextTask(): IndexQueueItem | null {
        if (this.queue.length === 0) return null;

        let bestIndex = 0;
        let best = this.queue[0];

        for (let i = 1; i < this.queue.length; i++) {
            const candidate = this.queue[i];

            const candidateIsBetter =
                candidate.priority < best.priority ||
                (
                    candidate.priority === best.priority &&
                    candidate.sequence < best.sequence
                );

            if (candidateIsBetter) {
                bestIndex = i;
                best = candidate;
            }
        }

        return this.queue.splice(bestIndex, 1)[0];
    }

    /**
     * Выполняет одну задачу индексации.
     */
    private async runTask(task: IndexQueueItem): Promise<void> {
        const { opts } = task;

        try {
            logger.lazyLoader(
                `ChapterIndexManager: indexing "${opts.chapterName}" with priority ${task.priority}`
            );

            const result = await this.indexer.index(opts, task.onProgress);

            this.cache.setChapter(result);

            await this.cache.save(opts.signal);

            logger.lazyLoader(
                `ChapterIndexManager: indexed and cached "${opts.chapterName}" (${result.pageCount} pages)`
            );

            task.resolve(result);
        } catch (error) {
            logger.error(
                `ChapterIndexManager: indexing failed for "${opts.chapterName}"`,
                error
            );

            task.reject(error);
        }
    }

    /**
     * Повышает приоритет задачи, если она ещё ждёт в очереди.
     *
     * Если задача уже выполняется, прервать её нельзя.
     * Новый priority повлияет только на задачи, которые ещё не стартовали.
     */
    private promoteInQueue(
        chapterKey: string,
        newPriority: IndexPriority
    ): void {
        const task = this.queue.find(
            item => item.opts.chapterKey === chapterKey
        );

        if (!task) return

        if (newPriority < task.priority) {
            logger.lazyLoader(
                `ChapterIndexManager: promoted "${chapterKey}" from priority ${task.priority} to ${newPriority}`
            );
            task.priority = newPriority;
        }
    }

    // ============================================================
    // Сервисные методы
    // ============================================================

    /**
     * Сохраняет persistent cache вручную.
     *
     * Обычно runTask() уже вызывает cache.save().
     * Этот метод полезен при закрытии плагина/ридера.
     */
    async save(): Promise<void> {
        await this.cache.save();
    }

    getCache(): ChapterIndexCache {
        return this.cache;
    }

    private ensureCacheLoaded(): Promise<void> {
        if (!this.cacheLoadPromise) {
            this.cacheLoadPromise = this.cache.load();
        }

        return this.cacheLoadPromise;
    }

    /**
     * Возвращает диагностическое состояние менеджера.
     * Удобно для логов/devtools.
     */
    getDebugState(): {
        queueLength: number;
        inFlightCount: number;
        isDraining: boolean;
        currentChapterKey: string | null;
    } {
        return {
            queueLength: this.queue.length,
            inFlightCount: this.inFlight.size,
            isDraining: this.isDraining,
            currentChapterKey: this.currentChapterKey,
        };
    }
}