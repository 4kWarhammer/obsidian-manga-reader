import * as React from "react";

export interface ElementSize {
    width: number;
    height: number;
}

export function useElementSize<T extends HTMLElement>(
    ref: React.RefObject<T | null>
): ElementSize {
    const [size, setSize] = React.useState<ElementSize>({
        width: 0,
        height: 0,
    });

    // Почему useLayoutEffect: он срабатывает после изменения DOM, но до paint. 
    // Это уменьшает шанс визуального мигания при первичном измерении.
    React.useLayoutEffect(() => {
        const element = ref.current;

        if (!element) return;

        const updateSize = () => {
            const rect = element.getBoundingClientRect();

            // Нам не нужны subpixel изменения
            // дробные размеры могут лишний раз пересобирать layout;
            const nextWidth = Math.round(rect.width);
            const nextHeight = Math.round(rect.height);

            setSize(prev => {
                if (prev.width === nextWidth && prev.height === nextHeight) {
                    return prev;
                }

                return {
                    width: nextWidth,
                    height: nextHeight,
                };
            });
        };

        updateSize();

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });

        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [ref]);

    return size;
}