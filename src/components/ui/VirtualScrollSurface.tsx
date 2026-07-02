import * as React from "react";
import { ImageProvider, ReaderLayout, ReaderPageLayout } from "src/types";
import { MangaPage } from "./MangaPage";

interface VirtualScrollSurfaceProps {
    readerLayout: ReaderLayout;
    visiblePages: ReaderPageLayout[];
    imageProvider: ImageProvider;
}

export const VirtualScrollSurface = React.memo(({
    readerLayout,
    visiblePages,
    imageProvider,
}: VirtualScrollSurfaceProps) => {
    return (
        <div
            className="virtual-reader-surface"
            style={{
                position: "relative",
                height: readerLayout.totalHeight,
                width: "100%",
            }}
        >
            {visiblePages.map(page => {
                const key = `${page.chapterName}:${page.index}`;
                const url = imageProvider.loadedUrls.get(key) || undefined;
                const shouldLoad = imageProvider.isInRange(page.chapterName, page.index);

                return (
                    <MangaPage
                        key={`${page.chapterKey}:${page.index}`}
                        index={page.index}
                        chapterName={page.chapterName}
                        url={url}
                        isLoading={!url && shouldLoad}
                        style={{
                            position: "absolute",
                            top: page.offsetTopInReader,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: page.renderedWidth,
                            height: page.renderedHeight,
                        }}
                    />
                );
            })}
        </div>
    );
});