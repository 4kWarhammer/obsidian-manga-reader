import type { TranslationSchema } from "./types";

export const en: TranslationSchema = {
    common: {
        back: "Back",
        loading: "Loading...",
        save: "Save",
        cancel: "Cancel",
        close: "Close",
        doubleClick: "Double click",
    },

    library: {
        title: "My Library",
        addVaultFolder: "Select Vault Folder",
        addExternalFolder: "+ External Folder",
        empty: "Library is empty. Add folders in settings above.",
        externalLabel: "[External]",
    },

    poster: {
        title: "Poster",
        image: "Image",
        settings: "Settings",
        doubleClick: "Double click - view",
    },

    rating: {
        title: "Rating",
        modalTitle: "Set rating to:",
        ratingInfo: "Enter or set a title rating",
    },

    explorer: {
        mode: "Mode:",
        vaultMode: "Obsidian's Vault",
        externalMode: "Disk (Desktop)",
        back: "📁 .. (up)",
        choose: "✅ Choose:",
        root: "Root",
    },

    title: {
        continueReading: "Continue reading",
        startReading: "Start reading",
        chapterList: "Chapter list",
        nameChange: "Press to change Name",
        openNote: "Create or open note",

        tabs: {
        description: "Description",
        chapters: "Chapters",
        comments: "Comments",
        },
    },

    chapterList: {
        empty: "Chapters not found",
        chapter: "Chapter",
        header: "Choose chapter",
    },

    reader: {
        nextChapter: "Next Chapter ➡",
        prevChapter: "⬅ Previous Chapter",
        noImages: "No images in this chapter",
        nextPage: "Next page",
        prevPage: "Prev. page",
        chapterCount: (current: number, total: number) =>
        `Chapter ${current} of ${total}`,
        headerName: "Reader settings",
        header: {
            content: "Open table of contents",
            chapter: "Chapter",
            settings: "Settings",
        }
    },

    settings: {
        viewModeTitle: "View mode settings",
        viewMode: "View mode",
        viewModeDesc: "Choose view mode settings",
        scroll: "Feed",
        singlePage: "Single page",
        indexWarmer: "Chapter preload",
        indexWarmerDescription: "Adjacent = ±1 chapters, Extended = ±2 chapters",
        adjacent: "Adjacent",
        extended: "Extended",
        backgroundIndexing: "Backgroung indexing",
        backgroundIndexingDescription: "Index all chapters of a title when opened",
        gapBetweenPage: "Gap between pages",
        readerWidth: "Reader width",

        settingsTitle: "Manga Reader settings",
        language: "Language",
        languageNotice: "Current language changed",
        lanDescription: "Choose interface language",
        sourcesTitle: "Library sources",
        defaultPath: "Default library folder",
        currentDefaultPath: "Current:",
        noCurrent: "No folder selected",
        selectDefaultFolder: "Select folder",
        defaultFolderNotice: "Default folder set to:",
        externalPath: "External sources",
        currentExternalPath: "Added external sources:",
        noExternalPath: "No external sources added",
        selectExternalFolder: "Add external folder",
        alreadyHas: "This path is already added",
        remove: "Remove external source",
        selectRemove: "Select a source to remove",
        removeButton: "Remove",
        removeNotice: "Removed:",

        notesFolderTitle: "Manga notes folder",
        notesFolderDesc: "",
        notesButtonText: "",
        notesFolderNotice: "Manga notes folder set to:",
        
        imageFolderTitle: "Manga images folder",
        imageFolderDesc: "",
        imageButtonText: "",
        imageFolderNotice: "Manga images folder set to:",
    },

    note: {
        placeholder: "📝 Double-click to create or open a note",
        empty: "Note is empty. Double-click to edit.",
        descriptionEmpty: `Note exists, but "Description" heading was not found`,
        commentsEmpty: `Note exists, but "Comments" heading was not found`,
        tagsEmpty: "No tags specified",
        headings: {
            description: "Description",
            comments: "Comments"
        },
    },

    modal: {
        titleName: "Title name",

        imageSelect: {
        headerName: "Select images",
        empty: "No images"
        },
    },
};