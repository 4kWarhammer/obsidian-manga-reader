import * as React from "react";
import { App, TFile } from "obsidian";

interface Props {
    app: App;
    images: string[];
    emptyPlaceholder?: React.ReactNode;
    coolDown?: number;
    onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    className?: string;
}

/**Работает только с внутренними путями */
export const ImagePoster = ({ 
    app,
    images,
    emptyPlaceholder,
    coolDown = 4000,
    onDoubleClick,
    className,
}: Props) => {
    const [currentSlide, setCurrentSlide] = React.useState(0);

    React.useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % images.length);
        }, coolDown);
        return () => clearInterval(timer);
    }, [images]);

    const getResourcePath = (imgPath: string): string => {
        const file = app.vault.getAbstractFileByPath(imgPath);
        if (file instanceof TFile) {
            return app.vault.getResourcePath(file);
        }
        return "";
    };

    return (
        <div
            className={`image-poster ${className || ""}`}
            onDoubleClick={onDoubleClick}
            title="Двойной клик — выбрать изображения"
        >
            {images.length > 0 ? (
                images.map((imgPath, i) => (
                    <img
                        key={imgPath}
                        src={getResourcePath(imgPath)}
                        className={i === currentSlide ? "active" : ""}
                        alt="poster"
                    />
                ))
            ) : (
                emptyPlaceholder || "🖼 Постер"
            )}
        </div>
    );
};