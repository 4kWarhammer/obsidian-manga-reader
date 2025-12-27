import * as React from "react";
import { App, TFolder, TFile } from "obsidian";
import JSZip from "jszip";
import MangaReaderPlugin from "../main";

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавили плагин
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onChapterChange: (chapterName: string, resetPage?: boolean) => void
    onBack: () => void;
}

export const ReaderPage = ({ app, plugin, parentPath, chapterName, onChapterChange, onBack }: Props) => {
    const [images, setImages] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const isAutoScrolling = React.useRef(true); // Состояние автоскролла
    const [allChapters, setAllChapters] = React.useState<string[]>([]); // храним список всех глав


    // Ссылка на контейнер, чтобы искать картинки внутри него
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Функция сохранения страницы в "базу"
    const saveProgress = async (pageIdx: number) => {
        if (isAutoScrolling.current) return; // Блокируем сохранение во время прыжка

        const path = parentPath;
        if (plugin.data.library[path]) {
            // Сохраняем главу
            plugin.data.library[path].lastChapter = chapterName
            // Сохраняем номер страницы (индекс + 1, чтобы было по-человечески с 1)
            plugin.data.library[path].lastPage = pageIdx + 1;
            await plugin.savePluginData();
            console.log(`Saved: Chapter ${chapterName}, Page ${pageIdx + 1}`);
        }
    };

    // Блок инициализации изображений, загрузка
    React.useEffect(() => {
        const loadImages = async () => {
            setIsLoading(true);
            const fullPath = `${parentPath}/${chapterName}`;
            const fileOrFolder = app.vault.getAbstractFileByPath(fullPath);
            let imageUrls: string[] = [];

            // ПОЛУЧАЕМ СПИСОК ВСЕХ ГЛАВ В ПАПКЕ
            const parentFolder = app.vault.getAbstractFileByPath(parentPath);
            
            if (parentFolder instanceof TFolder) {
                const chapters = parentFolder.children
                    .filter(f => {
                        // Оставляем только папки ИЛИ файлы-архивы
                        const isFolder = f instanceof TFolder;
                        const isArchive = f instanceof TFile && ['zip', 'cbz'].includes(f.extension.toLowerCase());
                        return isFolder || isArchive;
                    })
                    .map(f => f.name) // map выдает массив строк
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                setAllChapters(chapters);
            }

            // СЦЕНАРИЙ 1: ГЛАВА - ЭТО ПАПКА
            if (fileOrFolder instanceof TFolder) {                
                const imageFiles = fileOrFolder.children
                    .filter((f): f is TFile => 
                        f instanceof TFile && 
                        ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(f.extension.toLowerCase())
                    )
                    // 2. Сортируем их правильно (1.jpg, 2.jpg, 10.jpg)
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                // 3. Превращаем файлы в ссылки (URL)
                imageUrls = imageFiles.map(file => app.vault.getResourcePath(file)); // метод не универсалень - только в рамках хранилища работает
                
                setImages(imageUrls);
            }

            // СЦЕНАРИЙ 2: ГЛАВА - ЭТО АРХИВ (ZIP/CBZ)
            else if (fileOrFolder instanceof TFile && (fileOrFolder.extension === 'zip' || fileOrFolder.extension === 'cbz')) {
                // Читаем файл архива как массив байтов
                const arrayBuffer = await app.vault.readBinary(fileOrFolder);
                const zip = await JSZip.loadAsync(arrayBuffer);
                
                const entries: {name: string, file: JSZip.JSZipObject}[] = [];
                
                // Проходим по всем файлам внутри архива
                zip.forEach((relPath, file) => {
                    const ext = relPath.split('.').pop()?.toLowerCase();
                    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) {
                        entries.push({ name: relPath, file });
                    }
                });

                // Сортируем файлы внутри архива
                entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                // Превращаем каждый файл внутри архива во временную URL-ссылку (Blob)
                imageUrls = await Promise.all(
                    entries.map(async (entry) => {
                        const content = await entry.file.async("blob");
                        return URL.createObjectURL(content); // Создаем временный адрес в памяти
                    })
                );
            }

            setImages(imageUrls);
            setIsLoading(false);
        };
        loadImages();

        // Очистка памяти: когда закрываем главу, удаляем временные Blob-ссылки
        return () => {
            images.forEach(url => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, [app, parentPath, chapterName]);

    // Автоскролл при загрузке главы
    React.useEffect(() => {
        // Как только изменилось имя главы - блокируем сохранения
        isAutoScrolling.current = true;
        console.log("Switching chapter: scrolling locked");

        if (!isLoading && images.length > 0) {
            const performScroll = () => {
                const savedPage = plugin.data.library[parentPath]?.lastPage || 1;
                
                if (savedPage > 1) {
                    const targetImg = containerRef.current?.querySelector(
                        `img[data-page-idx="${savedPage - 1}"]`
                    ) as HTMLImageElement;

                    if (targetImg) {
                        targetImg.scrollIntoView({ block: 'start', behavior: "instant" });
                    }
                } else {
                    // НОВОЕ: Если страница 1, принудительно скроллим контейнер в самый верх
                    if (containerRef.current) {
                        containerRef.current.scrollTo({ top: 0, behavior: "instant" });
                        console.log("Forced scroll to top for Page 1");
                    }
                }
                
                // Ждем завершения анимации скролла и снимаем блокировку через секунду
                setTimeout(() => {
                    isAutoScrolling.current = false
                    console.log("Switching chapter: scrolling unlocked");
                }, 1000); 
            };

            performScroll();
        }
        // При закрытии страницы (unmount) или смене главы сбрасываем флаг в true для следующего раза
        return () => {
            isAutoScrolling.current = true;
        };

    }, [isLoading, images, chapterName]);

    // Эффект для отслеживания скролла
    React.useEffect(() => {
        if (isLoading || images.length === 0) return;

        // Создаем "наблюдателя"
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    // Если картинка видна более чем на 30%
                    if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                        const pageIdx = Number(entry.target.getAttribute("data-page-idx"));
                        saveProgress(pageIdx);
                    }
                });
            },
            {
                root: containerRef.current, // Следим внутри нашего контейнера
                threshold: 0.3 // Порог срабатывания (30% видимости)
            }
        );

        // Находим все картинки и вешаем на них наблюдение
        const imgs = containerRef.current?.querySelectorAll("img");
        imgs?.forEach((img) => observer.observe(img));

        return () => observer.disconnect(); // Чистим за собой
    }, [isLoading, images]);

    // заглушка при подгрузке страниц
    if (isLoading) return <div style={{ padding: "20px", color: "white" }}>Распаковка и загрузка глав...</div>;

    // Сам контейнер для отображения картинок
    return (        
        <div 
            ref={containerRef}
            style={{ height: "100%", overflowY: "auto", background: "#000", position: "relative" }}
        >
            {/* Панель управления (Sticky Header)  */}
            <div style={{ 
                position: "sticky", top: 0, padding: "10px", 
                background: "rgba(0,0,0,0.8)", zIndex: 10,
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <button onClick={onBack}>⬅ Назад</button>
                <span style={{ color: "white" }}>{chapterName}</span>
                <div style={{ width: "50px" }}></div> {/* Для баланса */}
            </div>

            {/* Лента изображений */}
            <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center",
                gap: "2px"
            }}>
                {images.length > 0 ? (
                    images.map((url, idx) => (
                        <img 
                            key={idx} 
                            src={url} 
                            data-page-idx={idx} // Добавляем индекс для слежки
                            style={{ 
                                maxWidth: "100%", 
                                height: "auto",
                                display: "block"
                            }} 
                            alt={`Страница ${idx + 1}`}
                        />
                    ))
                ) : (
                    <p style={{ color: "white", padding: "20px" }}>В этой главе нет изображений</p>
                )}
            </div>

            {/* Навигация внизу страницы */}
            {!isLoading && images.length > 0 && (
                <div style={{ 
                    padding: "40px 20px", 
                    display: "flex", 
                    flexDirection: "column", // Кнопки друг под другом или в ряд
                    alignItems: "center",
                    gap: "15px",
                    background: "#111",
                    marginTop: "20px"
                }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                        {/* Кнопка "Назад" (Предыдущая глава) */}
                        {allChapters.indexOf(chapterName) > 0 && (
                            <button onClick={() => {
                                const prevIdx = allChapters.indexOf(chapterName) - 1;
                                onChapterChange(allChapters[prevIdx], true);
                            }}>
                                ⬅ Предыдущая глава
                            </button>
                        )}

                        {/* Кнопка "Вперед" (Следующая глава) */}
                        {allChapters.indexOf(chapterName) < allChapters.length - 1 && (
                            <button 
                                style={{ background: "var(--interactive-accent)", color: "white" }}
                                onClick={() => {
                                    const nextIdx = allChapters.indexOf(chapterName) + 1;
                                    onChapterChange(allChapters[nextIdx], true);
                                }}
                            >
                                Следующая глава ➡
                            </button>
                        )}
                    </div>
                    
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8em" }}>
                        Глава {allChapters.indexOf(chapterName) + 1} из {allChapters.length}
                    </p>
                </div>
            )}
        </div>
    );
};