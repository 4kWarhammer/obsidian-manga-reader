import { off } from 'node:cluster';
import {
    CachedChapterIndex,
    ChapterLayout,
    PageLayout,
    ReaderLayout,
    ReaderPageLayout,
    VisibleRange,
} from 'src/types';

export interface ChapterLayoutOptions {
    containerWidth: number;
    pageGap: number; // Расстояние между изображениями
    horizontalPadding?: number; // Отступ внутрь по краям контейнера
    verticalPaddingTop?: number; // Верхний отступ
    verticalPaddingBottom?: number; // Нижний отступ
    maxPageWidth?: number; // Ограничитель максимальной ширины (как опция)
}

/**
 * Строит layout одной главы из persistent index metadata.
 *
 * Не создаёт Blob URL.
 * Не читает файлы.
 * Не зависит от DOM.
 */
export function buildChapterLayout(
    index: CachedChapterIndex,
    chapterName: string,
    options: ChapterLayoutOptions
): ChapterLayout {
    const horizontalPadding = options.horizontalPadding ?? 0;
    const verticalPaddingTop = options.verticalPaddingTop ?? 0;
    const verticalPaddingBottom = options.verticalPaddingBottom ?? 0;

    // Учитываем горизонтальные отступы
    const availableWidth = Math.max(0, options.containerWidth - horizontalPadding * 2);

    const targetWidth = options.maxPageWidth
        ? Math.min(availableWidth, options.maxPageWidth)
        : availableWidth;

    let offset = verticalPaddingTop;

    const pages: PageLayout[] = index.pages.map(page => {
        const renderedWidth = targetWidth;
        const renderedHeight = renderedWidth / page.aspectRatio;

        const offsetTopInChapter = offset;
        const offsetBottomInChapter = offsetTopInChapter + renderedHeight;

        offset = offsetBottomInChapter + options.pageGap;

        return {
            chapterKey: index.chapterKey,
            index: page.index,
            fileName: page.fileName,
            width: page.width,
            height: page.height,
            aspectRatio: page.aspectRatio,
            mimeType: page.mimeType,
            renderedWidth,
            renderedHeight,
            offsetTopInChapter,
            offsetBottomInChapter,
        };
    });

    const totalHeight = offset + verticalPaddingBottom;

    return {
        chapterKey: index.chapterKey,
        chapterName,
        pages,
        totalHeight,
    };
}

/**
 * Склеивает несколько ChapterLayout в общий ReaderLayout.
 */
export function buildReaderLayout(chapters: ChapterLayout[]): ReaderLayout {
    let chapterOffsetTop = 0;
    const pages: ReaderPageLayout[] = [];

    for (const chapter of chapters) {
        for (const page of chapter.pages) {
            const offsetTopInReader = chapterOffsetTop + page.offsetTopInChapter;
            const offsetBottomInReader = chapterOffsetTop + page.offsetBottomInChapter;

            pages.push({
                ...page,
                chapterKey: chapter.chapterKey,
                chapterName: chapter.chapterName,
                chapterOffsetTop,
                offsetTopInReader,
                offsetBottomInReader,
            });
        }

        chapterOffsetTop += chapter.totalHeight;
    }

    return {
        chapters,
        pages,
        totalHeight: chapterOffsetTop,
    };
}

/**
 * Находит страницу по вертикальному offset внутри reader-а.
 *
 * offset обычно равен scrollTop + clientHeight / 2,
 * если нужно найти страницу в центре viewport.
 */
export function findPageByOffset(
    pages: ReaderPageLayout[],
    offset: number
): ReaderPageLayout | null {
    if (pages.length === 0) {
        return null;
    }

    let low = 0;
    let high = pages.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const page = pages[mid];

        if (offset < page.offsetTopInReader) {
            high = mid - 1;
        } else if (offset >= page.offsetBottomInReader) {
            low = mid + 1;
        } else {
            return page;
        }
    }

    /**
     * Если offset попал в gap между страницами:
     * low указывает на следующую страницу.
     * Возвращаем ближайшую следующую, либо последнюю.
     */
    if (low < pages.length) {
        return pages[low];
    }

    return pages[pages.length - 1];
}

/**
 * Возвращает диапазон страниц, которые пересекаются с viewport,
 * плюс overscan сверху/снизу в пикселях.
 *
 * end — exclusive.
 */
export function getVisibleRange(
    readerLayout: ReaderLayout,
    scrollTop: number,
    clientHeight: number,
    overscan: number
): VisibleRange {
    const pages = readerLayout.pages;

    if (pages.length === 0) {
        return { start: 0, end: 0 };
    }

    const rangeTop = Math.max(0, scrollTop - overscan);
    const rangeBottom = scrollTop + clientHeight + overscan;

    const start = findFirstPageEndingAfter(pages, rangeTop);
    const end = findFirstPageStartingAfter(pages, rangeBottom);

    return {
        start: clamp(start, 0, pages.length),
        end: clamp(Math.max(end, start + 1), 0, pages.length),
    };
}

/**
 * Первая страница, у которой offsetBottomInReader > offset.
 */
function findFirstPageEndingAfter(
    pages: ReaderPageLayout[],
    offset: number
): number {
    let low = 0;
    let high = pages.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);

        if (pages[mid].offsetBottomInReader <= offset) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
}

/**
 * Первая страница, у которой offsetTopInReader > offset.
 *
 * Это удобно для exclusive end index.
 */
function findFirstPageStartingAfter(
    pages: ReaderPageLayout[],
    offset: number
): number {
    let low = 0;
    let high = pages.length;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);

        if (pages[mid].offsetTopInReader <= offset) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    return low;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}