import MangaReaderPlugin from "src/main";
import { useI18n } from "src/i18n/I18nContext";

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
    const { t } = useI18n();

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
                <p>{t.chapterList.empty}</p>
            )}
        </div>

    );
};