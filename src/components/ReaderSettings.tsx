import * as React from "react";
import MangaReaderPlugin from "src/main";
import { usePluginSettings } from "src/hooks/usePluginSettings";
import { useI18n } from "src/i18n/I18nContext";

interface Props {
    plugin: MangaReaderPlugin;
    onClose: () => void;
}

export const ReaderSettings = ({ plugin, onClose }: Props) => {
    // Подключаем хук для настроек
    const { settings, update } = usePluginSettings(plugin);
    const { t } = useI18n();

    return (
        <>
            {/* Заголовок */}
            <h3>{t.reader.headerName}</h3>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">{t.settings.viewMode}</div>
                </div>
                <div className="setting-item-control">
                    <select
                        className="dropdown"
                        value={settings.viewMode}
                        onChange={e => update("viewMode", e.target.value as "scroll" | "single")}
                    >
                        <option value="scroll">{t.settings.scroll}</option>
                        <option value="single">{t.settings.singlePage}</option>
                    </select>
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">{t.settings.indexWarmer}</div>
                    <div className="setting-item-description">
                        {t.settings.indexWarmerDescription}
                    </div>
                </div>
                <div className="setting-item-control">
                    <select
                        className="dropdown"
                        value={settings.indexWarmerMode}
                        onChange={e => update("indexWarmerMode", e.target.value as "adjacent" | "extended")}
                    >
                        <option value="adjacent">{t.settings.adjacent}</option>
                        <option value="extended">{t.settings.extended}</option>
                    </select>
                </div>
            </div>

            <div className="setting-item">
                <div className="setting-item-info">
                    <div className="setting-item-name">
                        {t.settings.backgroundIndexing}
                    </div>
                    <div className="setting-item-description">
                        {t.settings.backgroundIndexingDescription}
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
                    <div className="setting-item-name">{t.settings.gapBetweenPage}</div>
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
                    <div className="setting-item-name">{t.settings.readerWidth}</div>
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

            {/* Футер */}
            <div className="modal-footer">
                <button className="mod-cta" onClick={onClose}>{t.common.close}</button>
            </div>
        </>
    );
};