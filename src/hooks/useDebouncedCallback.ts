import * as React from "react";

/**
 * Хук, позволяющий выполнить callBack функцию через отведенное время
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
    callback: (...args: TArgs) => Promise<void> | void,
    delay: number
): {
    scheduleUpdate: (...args: TArgs) => void;
    flush: () => Promise<void>;
    cancel: () => void;
} {
    const callbackRef = React.useRef(callback);
    const timerRef = React.useRef<number | null>(null);
    const lastArgsRef = React.useRef<TArgs | null>(null);

    // Функция обнуления таймера
    const cancel = React.useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    //  Функция выполнения без ожидания
    //  Для срочных ситуаций, но только если аргументы уже есть
    const flush = React.useCallback(async () => {
        if (!lastArgsRef.current) return;

        // Сначала обнуляем таймер чтобы исключить двойное срабатывание от scheduleUpdate
        cancel();

        const args = lastArgsRef.current;
        lastArgsRef.current = null;

        await callbackRef.current(...args);
    }, [cancel]);

    // Выполнение по истечении времени
    const scheduleUpdate = React.useCallback((...args: TArgs) => {
        // Сохраняем аргументы
        lastArgsRef.current = args;

        // Сбрасываем таймер
        cancel();

        // Запускаем новый
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;

            const latestArgs = lastArgsRef.current;

            if (!latestArgs) return;

            lastArgsRef.current = null;

            // Вызываем callBack функцию
            void callbackRef.current(...latestArgs);
        }, delay);
    }, [cancel, delay]);

    React.useEffect(() => {
        return () => {
            cancel();
        };
    }, [cancel]);

    React.useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return {
        scheduleUpdate,
        flush,
        cancel, //На всякий случай, если нужно извне сбрасывать
    };
}