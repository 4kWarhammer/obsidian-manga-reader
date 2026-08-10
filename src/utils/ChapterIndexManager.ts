import { CachedChapterIndex } from 'src/types';
import {
    ChapterIndexerOptions,
    ChapterIndexerProgress,
} from 'src/utils/indexTypes';
import { ChapterIndexCache } from 'src/utils/ChapterIndexCache';
import { ChapterIndexer } from 'src/utils/ChapterIndexer';
import { logger } from 'src/utils/logger';

export type IndexPriority = 0 | 1 | 2 | 3;

interface IndexQueueItem {
    opts: ChapterIndexerOptions;
    priority: IndexPriority;
    sequence: number;
    onProgress?: (progress: ChapterIndexerProgress) => void;
    resolve: (index: CachedChapterIndex) => void;
    reject: (error: unknown) => void;
}

export class ChapterIndexManager {
    private cache: ChapterIndexCache;
    private indexer: ChapterIndexer;

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
     * AbortController для текущих выполняющихся задач.
     *
     * chapterKey -> AbortController
     *
     * Нужен для возможности прервать I/O индексации конкретной главы
     * без влияния на других consumers, которые могут ждать тот же Promise.
     */
    private taskAbortControllers = new Map<string, AbortController>();

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
        if (await this.cache.hasValidChapter(opts.chapterKey, signature)) {
            const cached = await this.cache.getChapter(opts.chapterKey);

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
        const controller = new AbortController();
        this.taskAbortControllers.set(opts.chapterKey, controller);

        try {
            logger.lazyLoader(
                `ChapterIndexManager: indexing "${opts.chapterName}" with priority ${task.priority}`
            );

            const result = await this.indexer.index(
                opts,
                task.onProgress,
                controller.signal
            );

            this.cache.setChapter(result);

            await this.cache.save();

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
        } finally {
            this.taskAbortControllers.delete(opts.chapterKey);
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

    /**
     * Прерывает индексацию конкретной главы, если она выполняется.
     * Задачи в очереди для этой главы удаляются.
     */
    abortChapter(chapterKey: string): void {
        const controller = this.taskAbortControllers.get(chapterKey);
        if (controller) {
            controller.abort();
            this.taskAbortControllers.delete(chapterKey);
        }

        const queueIndex = this.queue.findIndex(
            item => item.opts.chapterKey === chapterKey
        );
        if (queueIndex !== -1) {
            const task = this.queue.splice(queueIndex, 1)[0];
            task.reject(new Error(`Indexing aborted for ${chapterKey}`));
        }
    }

    /**
     * Прерывает все текущие задачи, очищает очередь и останавливает worker.
     * Полезно при закрытии плагина или полном сбросе.
     */
    dispose(): void {
        for (const [chapterKey, controller] of this.taskAbortControllers) {
            controller.abort();
            this.taskAbortControllers.delete(chapterKey);
        }

        for (const task of this.queue) {
            task.reject(new Error('ChapterIndexManager disposed'));
        }
        this.queue = [];

        this.isDraining = false;
    }

    /**
     * Возвращает диагностическое состояние менеджера.
     * Удобно для логов/devtools.
     */
    getDebugState(): {
        queueLength: number;
        inFlightCount: number;
        isDraining: boolean;
        activeTaskCount: number;
    } {
        return {
            queueLength: this.queue.length,
            inFlightCount: this.inFlight.size,
            isDraining: this.isDraining,
            activeTaskCount: this.taskAbortControllers.size,
        };
    }
}