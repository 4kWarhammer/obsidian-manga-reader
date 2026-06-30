

const LOG_FLAGS = {
    ReaderPage: true,
    imageLoader: false,
    cache: false,
    chapterCacheManager: false,
    lazyLoader: true,
    observer: true,
    performance: false,
};

export const logger = {
    ReaderPage: (...args: unknown[]) => {
        if (LOG_FLAGS.ReaderPage) console.debug(...args);
    },

    lazyLoader: (...args: unknown[]) => {
        if (LOG_FLAGS.lazyLoader) console.debug(...args);
    },

    imageLoader: (...args: unknown[]) => {
        if (LOG_FLAGS.imageLoader) console.debug(...args);
    },

    cache: (...args: unknown[]) => {
        if (LOG_FLAGS.cache) console.debug(...args);
    },

    ChapterCacheManager: (...args: unknown[]) => {
        if (LOG_FLAGS.chapterCacheManager) console.debug(...args);
    },

    observer: (...args: unknown[]) => {
        if (LOG_FLAGS.observer) console.debug(...args);
    },

    perf: (...args: unknown[]) => {
        if (LOG_FLAGS.performance) console.debug(...args);
    },

    warn: (...args: unknown[]) => {
        console.warn(...args);
    },

    error: (...args: unknown[]) => {
        console.error(...args);
    },
};