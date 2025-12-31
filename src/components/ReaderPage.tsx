import * as React from "react";
import { App, TFolder, TFile } from "obsidian";
import JSZip from "jszip";
import MangaReaderPlugin from "../main";
import { translations } from "src/i18n";

// Достаем Node.js модули
const fs = (window as any).require ? (window as any).require('fs') : null;
const pathModule = (window as any).require ? (window as any).require('path') : null;

interface Props {
    app: App;
    plugin: MangaReaderPlugin; // Добавили плагин
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onChapterChange: (chapterName: string, resetPage?: boolean) => void
    onBack: () => void;
}

// Блок инициализации изображений, загрузка
export const ReaderPage = ({ app, plugin, parentPath, chapterName, onChapterChange, onBack }: Props) => {
    const t = translations[plugin.data.settings.language || "en"]
    const [images, setImages] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const isAutoScrolling = React.useRef(true); 
    const [allChapters, setAllChapters] = React.useState<string[]>([]);
    const isArchive = chapterName.endsWith('.zip') || chapterName.endsWith('.cbz');
    const isExternal = parentPath.includes(":\\") || parentPath.startsWith("/");

    // REF ДЛЯ ПАМЯТИ: Храним текущие Blob-ссылки здесь, чтобы всегда иметь к ним доступ
    // Это надежнее, чем брать их из стейта images в функции очистки.
    const blobUrlsRef = React.useRef<string[]>([]);

    const containerRef = React.useRef<HTMLDivElement>(null);

    const getMimeType = (extension: string) => {
        const types: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'avif': 'image/avif'
        };
        return types[extension.toLowerCase()] || 'image/jpeg';
    };

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

    // --- ФУНКЦИЯ ОЧИСТКИ ПАМЯТИ ---
    const revokeOldBlobs = () => {
        blobUrlsRef.current.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        blobUrlsRef.current = []; // Обнуляем список после очистки
    };

    // --- МОДУЛЬНЫЙ ЗАГРУЗЧИК (Подготовка к будущему скроллу) ---
    // Вынесено отдельно, чтобы потом можно было вызывать для "подгрузки" следующей главы
    const fetchChapterImages = async (path: string, name: string): Promise<string[]> => {
        if (isArchive) {
            // ЛОГИКА АРХИВА (Универсальная)
            let binaryData: ArrayBuffer;
            if (isExternal && fs && pathModule) {
                const buffer = fs.readFileSync(pathModule.join(path, name));
                binaryData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            } else {
                const file = app.vault.getAbstractFileByPath(`${path}/${name}`);
                if (file instanceof TFile) binaryData = await app.vault.readBinary(file);
                else throw new Error("Архив не найден");
            }

            const zip = await JSZip.loadAsync(binaryData);
            const filePromises = Object.keys(zip.files)
                .filter(n => /\.(jpg|jpeg|png|webp|avif)$/i.test(n))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                .map(async n => {
                    const blob = await zip.file(n)!.async("blob");
                    return URL.createObjectURL(blob);
                });
            return Promise.all(filePromises);

        } else {
            // ЛОГИКА ПАПКИ (Теперь всё через Blob)
            if (isExternal && fs && pathModule) {
                // Внешняя папка
                const fullFolderPath = pathModule.join(path, name);
                const files = fs.readdirSync(fullFolderPath);
                return files
                    .filter((f: string) => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
                    .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }))
                    .map((f: string) => {
                        const data = fs.readFileSync(pathModule.join(fullFolderPath, f));
                        const ext = f.split('.').pop()?.toLowerCase();
                        const blob = new Blob([data], { type: getMimeType(ext) });
                        return URL.createObjectURL(blob);
                    });
            } else {
                // Vault папка (Тоже перевели на Blob для единообразия)
                const folder = app.vault.getAbstractFileByPath(`${path}/${name}`);
                if (!(folder instanceof TFolder)) return [];
                
                const files = folder.children
                    .filter((f): f is TFile => f instanceof TFile && /\.(jpg|jpeg|png|webp|avif)$/i.test(f.name))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                const promises = files.map(async f => {
                    const data = await app.vault.readBinary(f);
                    const ext = f.extension.toLowerCase();
                    const blob = new Blob([data], { type: getMimeType(ext) });
                    return URL.createObjectURL(blob);
                });
                return Promise.all(promises);
            }
        }
    };

    // Основной эффект загрузки
    React.useEffect(() => {        
        const initChapter = async () => {
            setIsLoading(true);
            
            // 1. Сначала чистим память от предыдущей главы
            revokeOldBlobs();
            try {
                // 2. Получаем список глав (оставляем твою логику)
                if (isExternal && fs && pathModule) {
                    const entries = fs.readdirSync(parentPath, { withFileTypes: true });
                    const names = entries
                        .filter((e: any) => e.isDirectory() || e.name.endsWith('.zip') || e.name.endsWith('.cbz'))
                        .map((e: any) => e.name)
                        .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
                    setAllChapters(names);
                } else {
                    const folder = app.vault.getAbstractFileByPath(parentPath);
                    if (folder instanceof TFolder) {
                        const names = folder.children
                            .filter(f => f instanceof TFolder || f.name.endsWith('.zip') || f.name.endsWith('.cbz'))
                            .map(f => f.name)
                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                        setAllChapters(names);
                    }
                }
                // 3. Загружаем изображения через наш новый загрузчик
                const newUrls = await fetchChapterImages(parentPath, chapterName);
                
                // Сохраняем ссылки в Ref для будущей очистки
                blobUrlsRef.current = newUrls;
                setImages(newUrls);

            } catch (error) {
                console.error("Ошибка загрузки:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initChapter();

        // Cleanup при уничтожении компонента
        return () => revokeOldBlobs();
    }, [parentPath, chapterName]); // Убрал app, он редко меняется и может вызвать лишние перезагрузки

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
    if (isLoading) return <div style={{ padding: "20px", color: "white" }}>{t.isloading}</div>;

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
                <button onClick={onBack}>{t.back}</button>
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
                    <p style={{ color: "white", padding: "20px" }}>{t.noImages}</p>
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
                                {t.prevChapter}
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
                                {t.nextChapter}
                            </button>
                        )}
                    </div>
                    
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8em" }}>
                        {t.chapterCount(allChapters.indexOf(chapterName) + 1, allChapters.length)}
                        {/* Глава {allChapters.indexOf(chapterName) + 1} из {allChapters.length} */}
                    </p>
                </div>
            )}
        </div>
    );
};