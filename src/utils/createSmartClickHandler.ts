/**Унмый обработчик двойных и одинарных кликов на одном элементе */
export function createSmartClickHandler(
    onClick: () => void,
    onDoubleClick: () => void,
    delay = 250
) {
    let timer: number | null = null;
    let count = 0;

    return () => {
        count += 1;

        if (count === 1) {
            timer = window.setTimeout(() => {
                if (count === 1) {
                    onClick();
                }
                count = 0;
            }, delay);
        }

        if (count === 2) {
            if (timer) window.clearTimeout(timer);
            count = 0;
            onDoubleClick();
        }
    };
}