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

interface LoadedChapter {
    chapterName: string;
    images: string[];
}

// Блок инициализации изображений, загрузка
export const ReaderPage = ({ app, plugin, parentPath, chapterName, onChapterChange, onBack }: Props) => {
    
    const t = translations[plugin.data.settings.language || "en"]
    const [images, setImages] = React.useState<string[]>([]);
    const [currentPage, setCurrentPage] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const isAutoScrolling = React.useRef(true); 
    // Грузим главы, много глав
    const [allChapters, setAllChapters] = React.useState<string[]>([]);
    const [loadedChapters, setLoadedChapters] = React.useState<LoadedChapter[]>([]);
    const observerRef = React.useRef<IntersectionObserver | null>(null); // вытаскиваем IntersectionObserver чтобы использовать не только в useEffect
    const isFetchingNext = React.useRef(false);
    // Проверочки
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
    const saveProgress = async (pageIdx: number, currentChapter: string) => {
        if (isAutoScrolling.current) return; // Блокируем сохранение во время прыжка

        const path = parentPath;
        const progress = plugin.data.library[path];
        if (progress) {
            if (progress.lastChapter === currentChapter && progress.lastPage === pageIdx + 1) {
                return
            }
            // Сохраняем главу
            progress.lastChapter = currentChapter
            // Сохраняем номер страницы (индекс + 1, чтобы было по-человечески с 1)
            progress.lastPage = pageIdx + 1;

            await plugin.savePluginData();
            console.log(`Saved: Chapter ${currentChapter}, Page ${pageIdx + 1}`);
        }
    };

    // Функция для перехода по страницам для single-page
    const goToPage = (index: number, chapter: string) => {        
        if (index >= images.length) {
            // Если вышли за пределы — пытаемся включить следующую главу
            const nextIdx = allChapters.indexOf(chapter) + 1;
            if (nextIdx < allChapters.length) {
                // Переходим на следующую главу, сбрасываем на 1 страницу
                onChapterChange(allChapters[nextIdx], true);
            }
            return;
        }
        if (index < 0) {
            // Если листаем назад с первой страницы — на предыдущую главу
            const prevIdx = allChapters.indexOf(chapter) - 1;
            if (prevIdx >= 0) {
                // Переходим на предыдущую главу
                // (Тут можно было бы заморочиться и открывать последнюю страницу той главы, 
                // но для начала просто переход на главу — уже круто)
                onChapterChange(allChapters[prevIdx], true);
            }
            return;
        }

        setCurrentPage(index);
        saveProgress(index, chapter); // Вызываем твою функцию сохранения в data.json
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

    // Загрузчик следующей главы для "бесконечного" скролла
    const loadNextChapter = async () => {
        // Сначала проверяем, не идет ли уже загрузка
        if (isFetchingNext.current) return;

        const lastLoaded = loadedChapters[loadedChapters.length - 1]?.chapterName;
        const currentIndex = allChapters.indexOf(lastLoaded); // chapterName - текущая активная
        const nextChapterName = allChapters[currentIndex + 1];

        // Если глав больше нет
        if (!nextChapterName) return;

        // Блокируем вызов
        isFetchingNext.current = true;

        // Добавляем спиннер или индикацию, если нужно (опционально)
        // setIsLoadingMore(true); 

        try{
            const newUrls = await fetchChapterImages(parentPath, nextChapterName);        
            // Добавляем новые URL в наш список Blob для очистки
            blobUrlsRef.current = [...blobUrlsRef.current, ...newUrls];
            // Добавляем новую главу в список загруженных

            // Пробую настроить выгрузку старых глав
            if (loadedChapters.length >= 3) {
                const chapterToRemove = loadedChapters[0];
                
                // 1. Чистим память браузера
                chapterToRemove.images.forEach(url => URL.revokeObjectURL(url));
                
                // 2. Чистим наш Ref с блобами (чтобы garbage collector их забрал)
                blobUrlsRef.current = blobUrlsRef.current.filter(url => !chapterToRemove.images.includes(url));
                
                // 3. Обновляем стейт - удаляем первую, добавляем новую
                setLoadedChapters(prev => {
                    const [, ...rest] = prev; // Удаляем первый элемент
                    return [...rest, { chapterName: nextChapterName, images: newUrls }];
                });
            }

            setLoadedChapters(prev => [...prev, { chapterName: nextChapterName, images: newUrls }]);
            
            // Важно: если твой JSX опирается на images.length, обнови и его
            // setImages(prev => [...prev, ...newUrls]); // (Опционально, если нужно)
            
            // Даем React время отрендерить новые картинки, прежде чем вешать на них Observer
            setTimeout(() => {
                const newImgs = containerRef.current?.querySelectorAll(`[data-chapter-name="${nextChapterName}"]`);
                newImgs?.forEach(img => observerRef.current?.observe(img));
            }, 300);
        } catch (e) {
            console.error("ошибка подгрузки главы:", e);
        } finally {
            isFetchingNext.current = false
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
                
                // 4. Сохраняем ссылки в Ref для будущей очистки
                blobUrlsRef.current = newUrls;
                setImages(newUrls);

                // Инициализируем ленту первой главой
                setLoadedChapters([{ chapterName, images: newUrls }]);

                // Читаем сохраненную страницу из плагина
                // Нужно для постраничного режима
                const savedData = plugin.data.library[parentPath];
                if (savedData && savedData.lastChapter === chapterName) {
                    const pageNum = savedData.lastPage || 0;
                    setCurrentPage(pageNum - 1); // Устанавливаем для постраничного режима
                } else {
                    setCurrentPage(0);
                }

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

    // Автоскролл при смене режима на "scroll"
    React.useEffect(() => {
        // Если пользователь переключился в режим скролла
        if (plugin.data.settings.viewMode === 'scroll' && images.length > 0) {
            // Даем React время отрисовать изображения в DOM (микро-задержка)
            setTimeout(() => {
                const targetImg = containerRef.current?.querySelector(`[data-page-idx="${currentPage}"]`);
                if (targetImg) {
                    targetImg.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
            }, 50);
        }
    }, [plugin.data.settings.viewMode]); // Срабатывает при смене режима

    // Эффект для отслеживания скролла
    React.useEffect(() => {
        if (isLoading || loadedChapters.length === 0 || plugin.data.settings.viewMode !== "scroll") return;

        // Создаем "наблюдателя"
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    // Срабатывает только когда картинка реально в зоне видимости
                    if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                        const idx = parseInt(entry.target.getAttribute('data-page-idx') || "0");
                        // Достаем главу именно из той картинки, которую сейчас видим!
                        const chapterFromImg = entry.target.getAttribute('data-chapter-name') || chapterName;

                        setCurrentPage(idx);
                        // Передаем оба параметра
                        saveProgress(idx, chapterFromImg);
                    }
                });
            },
            {
                root: containerRef.current, // Следим внутри нашего контейнера
                threshold: 0.3 // Порог срабатывания (30% видимости)
            }
        );
        

        // Находим все картинки и вешаем на них наблюдение
        const imgs = containerRef.current?.querySelectorAll("img[data-page-idx]");
        imgs?.forEach(img => observerRef.current?.observe(img));

        return () => {
            observerRef.current?.disconnect()
            observerRef.current = null
        }; // Чистим за собой
    }, [isLoading, loadedChapters, plugin.data.settings.viewMode]); // Пересоздаем при добавлении глав или смене режима

    // Наблюдаем когда подгрузить следующую главу
    React.useEffect(() => {
        if (plugin.data.settings.viewMode !== "scroll" || isLoading) return;

        const sensor = containerRef.current?.querySelector("#end-of-list-sensor");
        if (!sensor) return;

        const scrollObserver = new IntersectionObserver((entries) => {            
            if (entries[0].isIntersecting && !isFetchingNext.current) {
                // Проверяем, не последняя ли это глава
                const lastLoaded = loadedChapters[loadedChapters.length - 1]?.chapterName;
                const lastIndex = allChapters.indexOf(lastLoaded);
                
                if (lastIndex !== -1 && lastIndex < allChapters.length - 1) {
                    console.log("Sensor visible")
                    loadNextChapter();
                }
            }
        }, { 
            threshold: 0.1,
            root: null
        });

        
        scrollObserver.observe(sensor);
        return () => scrollObserver.disconnect();
    }, [loadedChapters, isLoading, plugin.data.settings.viewMode]);

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
                {/* кнопка назад */}
                <button onClick={onBack}>{t.back}</button>
                {/* кнопки смены режимов просмотра */}
                <div style={{ display: "flex", gap: "5px" }}>
                    <button 
                        onClick={() => {
                            plugin.data.settings.viewMode = 'scroll';
                            plugin.savePluginData();
                        }}
                        style={{ background: plugin.data.settings.viewMode === 'scroll' ? 'var(--interactive-accent)' : '' }}
                    >
                        {t.scrollMode}
                    </button>
                    <button 
                        onClick={() => {
                            plugin.data.settings.viewMode = 'single-page';
                            plugin.savePluginData();
                        }}
                        style={{ background: plugin.data.settings.viewMode === 'single-page' ? 'var(--interactive-accent)' : '' }}
                    >
                        {t.singlePageMode}
                    </button>
                </div>

                <span style={{ color: "white" }}>{chapterName}</span>
                <div style={{ width: "50px" }}></div> {/* Для баланса */}
            </div>

            <div className="reader-content">
                {plugin.data.settings.viewMode === "scroll" ? (
                    // Лента изображений
                    images.length > 0 ? (
                        <>
                            {loadedChapters.map((chapter) => (
                                <div key={chapter.chapterName} data-chapter={chapter.chapterName}>
                                    {chapter.images.map((url, imgIdx) => (
                                        <img 
                                            key={url} 
                                            src={url} 
                                            data-page-idx={imgIdx} 
                                            data-chapter-name={chapter.chapterName} // Понадобится для сохранения
                                            style={{ maxWidth: "100%", display: "block" }}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* Сенсор бесконечного скролла */}
                            <div 
                                id="end-of-list-sensor" 
                                style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                {/* Показываем текст или лоадер, если есть что подгружать */}
                                {allChapters.indexOf(loadedChapters[loadedChapters.length - 1]?.chapterName) < allChapters.length - 1 
                                    ? "Загрузка следующей главы..." 
                                    : "Конец списка"}
                            </div>
                        </>
                    ) : (<p style={{ color: "white", padding: "20px" }}>{t.noImages}</p>)
                ) : (
                    // Новый постраничный режим
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <img 
                            src={images[currentPage]} 
                            style={{ maxWidth: "100%", maxHeight: "80vh" }} 
                            onClick={(e) => {
                                // Клик по правой части — вперед, по левой — назад
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isRightClick = e.clientX - rect.left > rect.width / 2;
                                if (isRightClick) {
                                    goToPage(currentPage + 1, chapterName)
                                } else {
                                    goToPage(currentPage - 1, chapterName)
                                }
                            }}
                        />
                        <div style={{ color: "white", marginTop: "10px" }}>
                            {currentPage + 1} / {images.length}
                        </div>
                    </div>
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