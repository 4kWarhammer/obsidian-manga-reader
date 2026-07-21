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
    // триггер для сброса таймера при ручном переключении
    const [tick, setTick] = React.useState(0);

    React.useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % images.length);
        }, coolDown);

        return () => clearInterval(timer);
    }, [images, coolDown, tick]);

    const getResourcePath = (imgPath: string): string => {
        const file = app.vault.getAbstractFileByPath(imgPath);
        if (file instanceof TFile) {
            return app.vault.getResourcePath(file);
        }
        return "";
    };

    /** Рендерит «остров» точек с бесшовной wrap-around логикой */
    const renderDots = () => {
        if (images.length <= 1) return null;

        const total = images.length;
        const windowSize = 5; //Current, ±1, ±2
        const offsets: number[] = [];

        if (total <= windowSize) {
            for (let i = 0; i < total; i++) offsets.push(i);
        } else {
            for (let i = -2; i <= 2; i++) offsets.push(i);
        }

        return (
            <div className="image-poster-dots">
                {offsets.map((offset, idx) => {
                    // Индекс картинки, которую представляет точка
                    const dotIndex =
                        total <= windowSize
                            ? offset
                            : (currentSlide + offset + total) % total;

                    // «Геометрическое» расстояние до текущего слайда (с учётом кругового списка)
                    const distance =
                        total <= windowSize
                            ? Math.min(
                                  Math.abs(dotIndex - currentSlide),
                                  total - Math.abs(dotIndex - currentSlide)
                              )
                            : Math.abs(offset);

                    let sizeClass = "small";
                    if (distance === 0) sizeClass = "large";
                    else if (distance === 1) sizeClass = "medium";

                    const isActive = dotIndex === currentSlide;

                    return (
                        <button
                            key={idx}
                            type="button"
                            className={`image-poster-dot ${sizeClass} ${
                                isActive ? "active" : ""
                            }`}
                            onClick={() => {
                                if (!isActive) {
                                    setCurrentSlide(dotIndex);
                                    setTick((t) => t + 1); // сбрасываем таймер автоплея
                                }
                            }}
                            aria-current={isActive ? "true" : undefined}
                            aria-label={`Слайд ${dotIndex + 1}`}
                        />
                    );
                })}
            </div>
        );
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

            {renderDots()}
        </div>
    );
};