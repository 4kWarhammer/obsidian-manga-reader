import * as React from "react";

interface MangaPageProps {
    url?: string;
    index: number;
    chapterName: string;
    onClick?: (index: number, chName: string) => void;
    isLoading?: boolean;
    style?: React.CSSProperties;
}

function useDelayedBoolean(value: boolean, delayMs: number): boolean {
    const [delayedValue, setDelayedValue] = React.useState(false);

    React.useEffect(() => {
        if (!value) {
            setDelayedValue(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setDelayedValue(true);
        }, delayMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [value, delayMs]);

    return delayedValue;
}

const DelayedSpinner = React.memo(({ delayMs = 150 }: { delayMs?: number }) => {
    const shouldShow = useDelayedBoolean(true, delayMs);

    if (!shouldShow) return null;

    return (
        <div className="manga-page-loading">
            <div className="spinner"></div>
        </div>
    );
});

export const MangaPage = React.memo(({ url, index, chapterName, onClick, isLoading, style }: MangaPageProps) => {
    return (
        <div 
        className={`manga-page-wrapper ${url ? 'has-image' : 'no-image'}`}
        data-chapter-name={chapterName} 
        data-page-idx={index}
        style={style}
        // А вот это нижнее оставляю? тут вроде другая логика
        >
            {url ? (
                <img src={url} className="manga-img" />
            ) : isLoading ? (
                <DelayedSpinner delayMs={150} />
            ) : null}

            <div className="page-number-overlay">{index + 1}</div>
        </div>
    );
});