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

            setSize({
                width: rect.width,
                height: rect.height,
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