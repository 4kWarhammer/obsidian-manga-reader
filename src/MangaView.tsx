import { ItemView, WorkspaceLeaf, ViewStateResult, Platform } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
// Импортируем наш интерфейс-диспетчер для манги
import { MangaInterface } from "./MangaInterface";
// Импортируем класс твоего плагина
import MangaReaderPlugin from "./main"; 

export const VIEW_TYPE_MANGA = "manga-reader-view";

export type MangaViewState = {
    selectedTitle: string | null;
    selectedChapter: string | null;
} & Record<string, unknown>;

type AppWithCommands = {
    commands?: {
        executeCommandById?: (id: string) => boolean;
    };
};

const DEFAULT_MANGA_VIEW_STATE: MangaViewState = {
    selectedTitle: null,
    selectedChapter: null,
};

// Класс MangaView является тут "дверью" в Obsidian
// чисто делает так, чтобы плагин нормально дружил в ним
export class MangaView extends ItemView {
    root: ReactDOM.Root | null = null;
    plugin: MangaReaderPlugin; // Создаем место для хранения ссылки на плагин

    private viewState: MangaViewState = { ...DEFAULT_MANGA_VIEW_STATE };

    private shouldRecordHistory = true;

    // Обновляем конструктор: теперь он ждет (leaf, plugin)
    constructor(leaf: WorkspaceLeaf, plugin: MangaReaderPlugin) {
        super(leaf);
        this.plugin = plugin; // Сохраняем плагин в класс

        // Так типа навигация включается
        this.navigation = true;
    }

    getViewType() { 
        return VIEW_TYPE_MANGA; 
    }
    getDisplayText() { 
        return "Manga Reader"; 
    }
    getState() { 
        return { ...this.viewState }; 
    }

    async onOpen() {
        const container = this.containerEl.children[1] as HTMLElement;
        this.root = ReactDOM.createRoot(container);
        this.renderReact();

        await super.onOpen();
        
        // Проверяем, что скрытый объект history существует у текущей вкладки
        console.log("=== ОТЛАДКА ИСТОРИИ MANGA PLUGIN ===");
        console.log("Leaf object:", this.leaf);
        console.log("History object:", (this.leaf as any).history);
        
        if ((this.leaf as any).history) {
            console.log("Методы доступны:", {
                goBack: typeof (this.leaf as any).history.goBack,
                goForward: typeof (this.leaf as any).history.goForward,
                backHistory: (this.leaf as any).history.backHistory
            });
        } else {
            console.error("ВНИМАНИЕ: Obsidian заблокировал доступ к .history!");
        }
    }

    async onClose() {
        this.root?.unmount();
    }

    private normalizeState(state?: Partial<MangaViewState>): MangaViewState {
        return {
            selectedTitle: state?.selectedTitle ?? null,
            selectedChapter: state?.selectedChapter ?? null,
        };
    }

    // Obsidian получает setViewState(...) и вызывает этот метод,
    // Не понимаю тут логики, скрытая, но !!!!
    // Это стандартный lifecycle-метод ItemView.
    async setState(state: Partial<MangaViewState>, result: ViewStateResult) {
        const nextState = this.normalizeState(state);

        const changed =
            nextState.selectedTitle !== this.viewState.selectedTitle ||
            nextState.selectedChapter !== this.viewState.selectedChapter;

        this.viewState = nextState;

        if (changed && this.shouldRecordHistory) {
            result.history = true;
        }

        this.shouldRecordHistory = true;

        await super.setState(state, result);

        this.renderReact();

        if (changed) {
            this.refreshNavigationControls();
        }
    }

    /** Делает merge, меняет state и записывает точку в историю Obsidian */
    private navigate = async (
        nextState: Partial<MangaViewState>,
        options: { recordHistory?: boolean } = {}
    ) => {
        // Вот тут важно!!!
        // Это не склейка двух массивов. Это слияние!!!
        // создается новый изолированный объект
        const state: MangaViewState = {
            ...this.viewState,
            ...nextState,
        };

        this.shouldRecordHistory = options.recordHistory ?? true;

        try {
            await this.leaf.setViewState({
                type: VIEW_TYPE_MANGA,
                state,
                active: true,
            });
        } finally {
            this.shouldRecordHistory = true;
        }

        this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
        this.app.workspace.requestSaveLayout();
    };

    /** 
     * Основной выход из ReaderPage — настоящий Obsidian Back.
     * Fallback — переход на TitlePage без записи новой точки истории.
     */
    private goBackFromReader = () => {
        const beforeState = { ...this.viewState };

        this.app.workspace.setActiveLeaf(this.leaf, { focus: true });

        const app = this.app as AppWithCommands;
        const executed = app.commands?.executeCommandById?.("app:go-back") === true;

        // Fallback на случай если executeCommandById будет недоступен, изменен и прочее
        // Защищаемся от риска internal API
        window.setTimeout(async () => {
            const stateChanged =
                this.viewState.selectedTitle !== beforeState.selectedTitle ||
                this.viewState.selectedChapter !== beforeState.selectedChapter;

            if (executed && stateChanged) {
                return;
            }

            if (beforeState.selectedTitle && beforeState.selectedChapter) {
                await this.navigate(
                    {
                        selectedTitle: beforeState.selectedTitle,
                        selectedChapter: null,
                    },
                    {
                        recordHistory: false,
                    }
                );
            }
        }, 100);
    };

    /** Делает настоящий переход назад по истории Obsidian */
    // private goBack = () => {
    //     this.app.workspace.setActiveLeaf(this.leaf, { focus: true });

    //     requestAnimationFrame(() => {
    //         (this.app as any).commands.executeCommandById("app:go-back");
    //     });
    // };

    // Вынес в отдельный метод, потому что не только в onOpen будет
    private renderReact() {
        if (!this.root) return;

        this.root.render(
            <React.StrictMode>
                <MangaInterface 
                    app={this.app} 
                    plugin={this.plugin} 
                    selectedTitle={this.viewState.selectedTitle} 
                    selectedChapter={this.viewState.selectedChapter} 
                    navigate={this.navigate}
                    goBackFromReader={this.goBackFromReader}
                />
            </React.StrictMode>
        );
    }

    // Для мобильной навигации, она триггериться только от active-leaf-change
    private refreshNavigationControls() {
        requestAnimationFrame(() => {
            this.app.workspace.trigger("active-leaf-change", this.leaf);
        });
    }
}
