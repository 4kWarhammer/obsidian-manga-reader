import { useRef, useCallback, useEffect } from 'react';

export const useProgressDebounce = (
    // Основной callback, который реально записывает на диск
    onSave: (pageIdx: number, chapterName: string) => Promise<void>,
    // Время ожидания в миллисекундах (500мс)
    delay: number = 500
) => {
    // === ПАМЯТЬ ===
    // Храним текущее состояние, которое нужно сохранить
    const pendingRef = useRef<{
        pageIdx: number;
        chapterName: string;
    } | null>(null);
    
    // Таймер, который мы можем отменить если пришло новое событие
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Флаг: прямо сейчас записываем на диск?
    const isSavingRef = useRef(false);

    // === ФУНКЦИЯ: Записать данные на диск ===
    // Это НЕ вызывается часто, только один раз после 500мс
    const flush = useCallback(async () => {
        // Если нет накопленных данных - не делаем ничего
        if (!pendingRef.current || isSavingRef.current) {
            return;
        }

        const { pageIdx, chapterName } = pendingRef.current;
        isSavingRef.current = true;

        try {
            // Вызываем переданный callback (он уже знает как сохранить)
            await onSave(pageIdx, chapterName);
            // После успеха - очищаем буфер
            pendingRef.current = null;
        } finally {
            isSavingRef.current = false;
        }
    }, [onSave]);

    // === ФУНКЦИЯ: Запланировать обновление ===
    // Её будешь вызывать из IntersectionObserver
    // Это тоже сохранение, но отложенное с таймером
    const scheduleUpdate = useCallback((pageIdx: number, chapterName: string) => {
        // 1. Запоминаем новые данные в памяти (не записываем на диск!)
        pendingRef.current = { pageIdx, chapterName };

        // 2. Отменяем старый таймер если он был
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // 3. Запускаем новый таймер на 500мс
        timerRef.current = setTimeout(() => {
            flush();
        }, delay);
    }, [flush, delay]);

    // === CLEANUP: Когда компонент умирает ===
    useEffect(() => {
        return () => {
            // Перед уходом - сохраняем всё что осталось в памяти
            // Вызываем flush СИНХРОННО (не async), чтобы не потерять данные
            if (pendingRef.current && !isSavingRef.current) {
                flush();
            }
            // Отменяем таймер, чтобы не было утечек памяти
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [flush]);

    return { 
        scheduleUpdate, 
        flush,
    };
};