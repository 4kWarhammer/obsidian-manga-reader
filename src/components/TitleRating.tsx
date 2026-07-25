import * as React from "react";
import { App } from "obsidian";
import { RatingModal } from "../modal/RatingModal";

interface Props {
    /** Значение из useTitleNote (number | null | undefined) */
    rating: number | null | undefined;
    app?: App;
    onChange?: (rating: number) => void;
    size?: "default" | "small";
}

export const TitleRating = ({ rating, app, onChange, size = "default" }: Props) => {
    // fallback: null / undefined / пустое поле → 0.0
    const value = rating ?? 0;
    const clamped = Math.max(0, Math.min(10, value));
    const formatted = clamped.toFixed(1);

    // Выставляем по умолчанию
    let colorClass = "rating-gray";

    if (clamped > 9) {
        colorClass = "rating-gold";
    } else if (clamped > 7) {
        colorClass = "rating-green";
    } else if (clamped > 4) {
        colorClass = "rating-yellow";
    } else if (clamped > 0) {
        colorClass = "rating-red";
    }

    const handleClick = () => {
        if (!app || !onChange) return;
        new RatingModal(app, rating, onChange).open();
    };

    return (
        <span 
        className={`
            title-rating 
            ${colorClass} ${onChange ? "rating-clickable" : ""} 
            ${size === "small" ? "title-rating-small" : ""}
        `}
        title={`Рейтинг ${formatted}`} 
        onClick={handleClick}
        >
            <span className="rating-icon">★</span>
            <span className="rating-value">{formatted}</span>
        </span>
    );
};