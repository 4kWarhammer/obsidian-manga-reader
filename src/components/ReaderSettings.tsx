import * as React from "react";
import MangaReaderPlugin from "src/main";

interface Props {
    plugin: MangaReaderPlugin;
    onClose: () => void;
}

export const ReaderSettings: React.FC<Props> = ({ plugin, onClose }) => {
    return (
        <div className="reader-settings-panel">
            <h2>Настройки читалки</h2>
            <p>Здесь будут опции плагина.</p>
            <button onClick={onClose}>Закрыть</button>
        </div>
    );
};