import type { TranslationSchema } from "./types";

export const en: TranslationSchema = {
  common: {
    back: "⬅ Back",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
  },

  library: {
    title: "📚 My Library",
    addVaultFolder: "Select Vault Folder",
    addExternalFolder: "+ External Folder",
    empty: "Library is empty. Add folders in settings above.",
    externalLabel: "[External]",
  },

  explorer: {
    mode: "Mode:",
    vaultMode: "Obsidian's Vault",
    externalMode: "Disk (Desktop)",
    back: "📁 .. (up)",
    choose: "✅ Choose:",
    root: "Root",
  },

  titlePage: {
    continueReading: "Continue reading",
    startReading: "Start reading",
    chapterList: "Chapter list",

    tabs: {
      description: "Description",
      chapters: "Chapters",
      comments: "Comments",
    },
  },

  chapterList: {
    empty: "Chapters not found",
  },

  reader: {
    nextChapter: "Next Chapter ➡",
    prevChapter: "⬅ Previous Chapter",
    noImages: "No images in this chapter",
    scrollMode: "Feed",
    singlePageMode: "Page-by-page",
    nextPage: "Next page",
    prevPage: "Prev. page",
    chapterCount: (current: number, total: number) =>
      `Chapter ${current} of ${total}`,
  },

  note: {
    placeholder: "📝 Double-click to create a note",
    empty: "Note is empty. Double-click to edit.",
    descriptionEmpty: "Note exists, but description heading was not found",
    commentsEmpty: "Note exists, but comments heading was not found",
    tagsEmpty: "No tags specified",
  },

  modal: {
    save: "Save",
    cancel: "Cancel",
    selectImages: "Select images",
    empty: "No images",
  },
};