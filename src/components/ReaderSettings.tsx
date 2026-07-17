import * as React from "react";
import MangaReaderPlugin from "src/main";
import { usePluginSettings } from "src/hooks/usePluginSettings";

interface Props {
    plugin: MangaReaderPlugin;
    onClose: () => void;
}

export const ReaderSettings = ({ plugin, onClose }: Props) => {
    // Подключаем хук для настроек
    const { settings, update } = usePluginSettings(plugin);

    return (
        <div className="reader-settings-content">
            <h3>Настройки читалки</h3>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Режим чтения</div>
                </div>
                <div className="setting-item-control">
                    <select
                        className="dropdown"
                        value={settings.viewMode}
                        onChange={e => update("viewMode", e.target.value as "scroll" | "single")}
                    >
                        <option value="scroll">Скролл</option>
                        <option value="single">Постраничный</option>
                    </select>
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Index Warmer</div>
                    <div className="setting-item-description">
                        adjacent = соседние главы, extended = ±2 главы
                    </div>
                </div>
                <div className="setting-item-control">
                    <select
                        className="dropdown"
                        value={settings.indexWarmerMode}
                        onChange={e => update("indexWarmerMode", e.target.value as "adjacent" | "extended")}
                    >
                        <option value="adjacent">Соседние</option>
                        <option value="extended">Расширенный</option>
                    </select>
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Фоновая индексация</div>
                    <div className="setting-item-description">
                        Индексировать все главы тайтла при открытии
                    </div>
                </div>
                <div className="setting-item-control">
                    <input
                        type="checkbox"
                        checked={settings.readerBackgroundIndexing}
                        onChange={e => update("readerBackgroundIndexing", e.target.checked)}
                    />
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Отступ между страницами</div>
                    <div className="setting-item-description">{settings.pageGap}px</div>
                </div>
                <div className="setting-item-control">
                    <input
                        type="range"
                        min={0}
                        max={15}
                        value={settings.pageGap}
                        onChange={e => update("pageGap", Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">Ширина читалки</div>
                    <div className="setting-item-description">{settings.readerWidthPercent}%</div>
                </div>
                <div className="setting-item-control">
                    <input
                        type="range"
                        min={50}
                        max={100}
                        step={1}
                        value={settings.readerWidthPercent}
                        onChange={e => update("readerWidthPercent", Number(e.target.value))}
                    />
                </div>
            </div>

            <div style={{ marginTop: "1rem", textAlign: "right" }}>
                <button className="mod-cta" onClick={onClose}>Закрыть</button>
            </div>
        </div>
    );
};