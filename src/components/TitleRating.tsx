import * as React from "react";
import { useState } from "react";
import { useI18n } from "src/i18n/I18nContext";

interface Props {
    initialRating: number;
    onSave: (rating: number) => void;
    onClose: () => void;
}

export const TitleRating = ({ initialRating, onSave, onClose }: Props) => {
    const { t } = useI18n();
    const [rating, setRating] = useState(initialRating);
    const [inputValue, setInputValue] = useState(initialRating.toFixed(1));

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        const clamped = Math.max(0, Math.min(10, val));
        setRating(clamped);
        setInputValue(clamped.toFixed(1));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.trim().replace(",", ".");
        setInputValue(raw);
        
        const val = parseFloat(raw);
        if (!isNaN(val)) {
            const clamped = Math.max(0, Math.min(10, val));
            setRating(clamped);
        }
    };

    const handleInputBlur = () => {
        const raw = inputValue.trim().replace(",", ".");
        let val = parseFloat(raw);
        if (isNaN(val)) val = initialRating;
        const clamped = Math.max(0, Math.min(10, val));
        setRating(clamped);
        setInputValue(clamped.toFixed(1));
    };

    const handleSave = () => {
        const raw = inputValue.trim().replace(",", ".");
        const val = parseFloat(raw);
        const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(10, val));
        onSave(clamped);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <div className="custom-modal-container">
            {/* Заголовок */}
            <h3>{t.rating.modalTitle} {isNaN(parseFloat(inputValue)) ? "—" : rating.toFixed(1)}</h3>

            {/* Крупное число текущего значения */}
            {/* <div className="rating-modal-value">
                {isNaN(parseFloat(inputValue)) ? "—" : rating.toFixed(1)}
            </div> */}

            <div className="setting-item">
                <div className="setting-item-info">
                    {t.rating.ratingInfo}
                </div>
                <div className="setting-item-control multi-elements">
                    {/* Числовое поле для ручного ввода */}
                    <input
                        type="number"
                        className="rating-modal-number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        onKeyDown={handleKeyDown}
                    />

                    {/* Ползунок 0…10, шаг 0.1 */}
                    <input
                        type="range"
                        className="rating-modal-slider"
                        min={0}
                        max={10}
                        step={0.1}
                        value={rating}
                        onChange={handleSliderChange}
                    />

                </div>
            </div>


            {/* Футер */}
            <div className="modal-footer">
                <button className="mod-cta" onClick={onClose}>{t.common.cancel}</button>
                <button className="mod-cta" onClick={handleSave}>
                    {t.common.save}
                </button>
            </div>
        </div>
    );
};