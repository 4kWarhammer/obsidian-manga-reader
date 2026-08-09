import * as React from "react";
import { App, TFile } from "obsidian";
import * as Lucide from "lucide-react";
import { useI18n } from "src/i18n/I18nContext";
import { TitleRatingWidget } from "./TitleRatingWidget";

interface Props {
    app: App;
    images: string[];
    emptyPlaceholder?: React.ReactNode;
    coolDown?: number;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    className?: string;

    // Опциональные пропсы для рейтинга
    rating?: number | null;
    onRatingChange?: (rating: number) => void;
}

/**Работает только с внутренними путями */
export const ImagePoster = ({ 
    app,
    images,
    emptyPlaceholder,
    coolDown = 4000,
    onClick,
    // На него потом сделаем открытие предпросмотра с листанием.
    onDoubleClick,
    className,
    rating,
    onRatingChange,
}: Props) => {
    const { t } = useI18n();
    const [currentSlide, setCurrentSlide] = React.useState(0);
    // триггер для сброса таймера при ручном переключении
    const [tick, setTick] = React.useState(0);

    // Может без useEffect? как будто бы он довольно тяжелый...
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
                            // Текст при наведении
                            aria-label={`${t.poster.image} ${dotIndex + 1}`}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div
            // Не помню зачем, но можно дополнять класс извне
            className={`image-poster ${className || ""}`}
            // Название при наведении
            title={t.poster.title}
            aria-label={t.poster.title}
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
                emptyPlaceholder || <Lucide.ImageMinus size={48}/>
            )}

            {/* Рейтинг в левом верхнем углу (если передан) */}            
            <div className="image-poster-header">
                {rating ? (
                <TitleRatingWidget
                    rating={rating}
                    app={app}
                    onChange={onRatingChange}
                />
                ) : (
                    // Заглушка
                    <span></span>
                )
            }

                {/* Настройки / выбор изображений */}
                {onClick && (
                    <button
                        type="button"
                        className="image-poster-settings"
                        onClick={(e) => onClick(e as any)}
                        title={t.poster.settings}
                        aria-label={t.poster.settings}
                    >
                        <Lucide.Settings/>
                    </button>
                )}
            </div>

            {renderDots()}
        </div>
    );
};