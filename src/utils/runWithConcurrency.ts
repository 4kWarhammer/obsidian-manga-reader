/**
 * Generic функция, для итерация по объекту с concurrency
 * то есть ограничением на паралельную работу
 * @param items объект итерируемый
 * @param concurrency количество параллельных workers
 * @param worker работает по Titem и его индексу
 * @param onItemDone важно, реальный порядок из-за concurrency может нарушаться, но для просто индекса - пойдет
 */
export async function runWithConcurrency<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    worker: (item: TItem, index: number) => Promise<TResult>,
    onItemDone?: (index: number, result: TResult, item: TItem) => void
): Promise<TResult[]> {
    const results: TResult[] = new Array(items.length);
    let nextIndex = 0;

    async function runWorker(): Promise<void> {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            const item = items[index];

            const result = await worker(item, index);

            results[index] = result;

            onItemDone?.(index, result, item);
        }
    }

    if (items.length === 0) {
        return [];
    }
    
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
        Array.from({ length: workerCount }, () => runWorker())
    );

    return results;
}