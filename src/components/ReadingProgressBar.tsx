import * as React from "react";

export interface ReadingProgressProps {
    current: number;   // прочитано глав (0 — не начато)
    total: number;     // всего глав
    label: string;     // уже готовая строка, например "Глава 5 из 32"
}

export const ReadingProgressBar = ({ current, total, label }: ReadingProgressProps) => {
    if (total === 0) return null;
    const percent = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="reading-progress">
            <div className="progress-label">{label}</div>
            <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};