import MangaReaderPlugin from "src/main";
import { useI18n } from "src/i18n/I18nContext";

interface Props {
    chapters: string[];
    onSelectChapter: (chapterName: string, resetPage?: boolean) => void;
    header?: boolean;
    onClose?: () => void;
}

/**
 * Глупый UI компонент, можно было бы напрямую вызывать в него useChapterList хук
 * Однако пусть лучше наследует его через пропсы от родителей.
 * Требует нормальной стилизации
 */
export const ChapterListPage = ({ 
    chapters, 
    header = false,
    onSelectChapter, 
    onClose,
}: Props) => {
    const { t } = useI18n();

    return (
        <div 
            className="manga-chapter-list"
        >
            {header && <h3>{t.chapterList.header}</h3>}

            {chapters.length > 0 ? (
                chapters.map((name, index) => (
                    <div
                        key={name}
                        onClick={() => onSelectChapter(name, true)}
                        className={`chapter ${name}`}
                        title={name}
                    >
                        {t.chapterList.chapter} {index + 1}
                    </div>
                ))
            ) : (
                <p>{t.chapterList.empty}</p>
            )}

            {header && (
                <div className="modal-footer">
                    <button className="mod-cta" onClick={onClose}>{t.common.close}</button>
                </div>
            )}
        </div>

    );
};