import * as React from "react";
import MangaReaderPlugin from "src/main";
import { PluginData } from "src/types";

/**
 * Единый хук для остальных UI компонентов для записи настроек в data.json
 * И выдачи результатов изменения настроек
 * @returns settings, update
 */
export function usePluginSettings(plugin: MangaReaderPlugin) {
    const [settings, setSettings] = React.useState<PluginData["settings"]>(
        () => ({ ...plugin.data.settings })
    );

    React.useEffect(() => {
        const handleUpdate = () => {
            setSettings({ ...plugin.data.settings });
        };
        (plugin.app.workspace as any).on("manga-reader:settings-update", handleUpdate);
        return () => {
            (plugin.app.workspace as any).off("manga-reader:settings-update", handleUpdate);
        };
    }, [plugin]);

    /**
     * Единственная функция .которая имеет право писать в plugin.data.settings из UI.
     */
    const update = <K extends keyof PluginData["settings"]>(
        key: K,
        value: PluginData["settings"][K]
    ) => {
        plugin.data.settings[key] = value;
        // Оптимистично обновляем UI сразу, не ждём события
        setSettings(prev => ({ ...prev, [key]: value }));
        void plugin.saveSettings();
    };

    return { settings, update } as const;
}