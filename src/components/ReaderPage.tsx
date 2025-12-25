import * as React from "react";
import { App, TFolder, TFile } from "obsidian";
import JSZip from "jszip";

interface Props {
    app: App;
    parentPath: string;   // Путь к папке манги
    chapterName: string;  // Название папки главы
    onBack: () => void;
}

export const ReaderPage = ({ app, parentPath, chapterName, onBack }: Props) => {
    const [images, setImages] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const loadImages = async () => {
            setIsLoading(true);
            const fullPath = `${parentPath}/${chapterName}`;
            const fileOrFolder = app.vault.getAbstractFileByPath(fullPath);

            let imageUrls: string[] = [];

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

    // заглушка при подгрузке страниц
    if (isLoading) return <div style={{ padding: "20px", color: "white" }}>Распаковка и загрузка глав...</div>;

    // Сам контейнер для отображения картинок
    return (
        <div style={{ height: "100%", overflowY: "auto", background: "#000" }}>
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
                    images.map((url, index) => (
                        <img 
                            key={index} 
                            src={url} 
                            style={{ 
                                maxWidth: "100%", 
                                height: "auto",
                                display: "block"
                            }} 
                            alt={`Страница ${index + 1}`}
                        />
                    ))
                ) : (
                    <p style={{ color: "white", padding: "20px" }}>В этой главе нет изображений</p>
                )}
            </div>
        </div>
    );
};