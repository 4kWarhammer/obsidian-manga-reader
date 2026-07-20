import * as React from "react";
import { App, MarkdownRenderer, Component } from "obsidian";

/**
 * Чтобы Obsidian-разметка (жирный, ссылки, чекбоксы) рендерилась правильно
 */
export const MarkdownNote = ({ app, source, path }: { app: App; source: string; path: string }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const compRef = React.useRef<Component>(new Component());

    React.useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;
        el.empty();

        // Убираем YAML-frontmatter из превью
        const clean = source.replace(/^---[\s\S]*?---\s*/, "").trim();

        MarkdownRenderer.render(app, clean, el, path, compRef.current).then(() => {
            // Obsidian иногда вставляет <pre> для plain text — это нормально
        });

        return () => {
            compRef.current?.unload();
        };
    }, [source, path]);

    return (
        <div
            className="note-content markdown-preview-view"
            ref={ref}
        />
    );
};