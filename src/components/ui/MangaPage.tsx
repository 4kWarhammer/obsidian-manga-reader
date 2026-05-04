import * as React from "react";

interface MangaPageProps {
    url?: string;
    index: number;
    chapterName: string;
    onClick?: (index: number, chName: string) => void;
    isLoading?: boolean;
}

export const MangaPage = React.memo(({ url, index, chapterName, onClick, isLoading }: MangaPageProps) => {
    // c onClick пока не решил по функционалу нужен ли он здесь
    // но он пока не мешает - оставлю

    return (
        <div 
        className="manga-page-wrapper" 
        data-chapter-name={chapterName} 
        data-page-idx={index}
        >
            {isLoading ? (
                <div className="manga-page-loading">
                    <div className="spinner"></div>
                </div>
            ) : (
                url && <img src={url} className="manga-img" />
            )}
            <div className="page-number-overlay">{index + 1}</div>
        </div>
    );
});