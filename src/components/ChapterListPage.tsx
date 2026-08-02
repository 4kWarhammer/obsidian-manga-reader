import { translations } from "src/i18n";
import MangaReaderPlugin from "src/main";

interface Props {
    plugin?: MangaReaderPlugin;     // Пока сделаю опциональным чтобы не пробрасывать в ReaderHeader
    chapters: string[];
    onSelectChapter: (chapterName: string, resetPage?: boolean) => void;
    onClose?: () => void;
}

/**
 * Глупый UI компонент, можно было бы напрямую вызывать в него useChapterList хук
 * Однако пусть лучше наследует его через пропсы от родителей.
 * Требует нормальной стилизации
 */
export const ChapterListPage = ({ plugin, chapters, onSelectChapter, onClose }: Props) => {
    const t = translations[plugin?.data.settings.language || "en"];

    return (
        <div 
            className="manga-chapter-list"
        >
            {chapters.length > 0 ? (
                chapters.map(name => (
                    <div
                        key={name}
                        onClick={() => onSelectChapter(name, true)}
                        className={`chapter ${name}`}
                    >
                        {name}
                    </div>
                ))
            ) : (
                <p>{t.nochapters}</p>
            )}
        </div>

    );
};