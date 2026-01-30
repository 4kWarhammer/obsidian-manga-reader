import * as React from "react";

interface MangaPageProps {
    url: string;
    index: number;
    chapterName: string;
    onClick?: (index: number, chName: string) => void;
    
}

export const MangaPage = ({ url, index, chapterName, onClick }: MangaPageProps) => {
    return (
        <div className="manga-page-wrapper" data-chapter-name={chapterName} data-page-idx={index}>

            <img 
                src={url} 
                className="manga-img"
                // loading="lazy" 
            />
            <div className="page-number-overlay">{index + 1}</div>
        </div>
    );
};