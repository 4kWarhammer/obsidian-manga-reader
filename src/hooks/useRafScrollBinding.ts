import * as React from "react";

/**
 * Хук вешает на container addEventListener и делает скролл
 */
export function useRafScrollBinding(
    containerRef: React.RefObject<HTMLDivElement | null>,
    onScroll: (scrollTop: number, clientHeight?: number | undefined) => void
): void {
    const scrollRafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleVirtualScroll = () => {            
            if (scrollRafRef.current !== null) return;

            scrollRafRef.current = window.requestAnimationFrame(() => {
                scrollRafRef.current = null;

                if (!containerRef.current) return;
                const {scrollTop, clientHeight} = containerRef.current
                onScroll(scrollTop, clientHeight);
            });
        }

        container.addEventListener("scroll", handleVirtualScroll, { passive: true });

        return () => {
            container.removeEventListener("scroll", handleVirtualScroll);

            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current);
                // Обнуляем на случай, если эффект перезапустится из-за смены onScroll
                scrollRafRef.current = null; 
            }
        };
    }, [containerRef, onScroll]);
}