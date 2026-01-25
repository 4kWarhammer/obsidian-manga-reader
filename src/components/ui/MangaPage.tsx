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
            
            {/* Клик-зона Назад (левые 30% экрана) */}
            <div 
                className="click-zone left" 
                onClick={() => onClick(index - 1, chapterName)}
            />

            <img 
                src={url} 
                className="manga-img"
                // loading="lazy" 
            />

            {/* Клик-зона Назад (левые 30% экрана) */}
            <div 
                className="click-zone right" 
                onClick={() => onClick(index + 1, chapterName)}
            />

            <div className="page-number-overlay">{index + 1}</div>
        </div>
    );
};