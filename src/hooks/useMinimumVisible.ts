import * as React from "react";

/**
* Гарантирует видимость элемента минимум заданное время,
 * даже если флаг бастро сменится на false
 */
export function useMinimumVisible(active: boolean, minMs: number): boolean {
    const [visible, setVisible] = React.useState(active);
    const startedAtRef = React.useRef<number | null>(active ? Date.now() : null);

    React.useEffect(() => {
        // Если положительный флаг, то запускаем таймер
        if (active) {
            if (startedAtRef.current === null) {
                startedAtRef.current = Date.now();
            }

            setVisible(true);
            return;
        }

        if (!visible) return;

        const startedAt = startedAtRef.current;
        const elapsed = startedAt ? Date.now() - startedAt : minMs;
        const remaining = Math.max(0, minMs - elapsed);

        const timer = window.setTimeout(() => {
            setVisible(false);
            startedAtRef.current = null;
        }, remaining);

        return () => {
            window.clearTimeout(timer);
        };
    }, [active, minMs, visible]);

    return active || visible;
}