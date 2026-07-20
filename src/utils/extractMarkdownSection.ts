/**
 * Вырезает содержимое секции из markdown по заголовку.
 * Сам заголовок не включается. Остановка — при встрече заголовка
 * того же или более высокого уровня.
 */
export function extractMarkdownSection(
    text: string,
    heading: string
): string | null {
    const lines = text.split("\n");
    let targetLevel = 0;
    let collecting = false;
    const result: string[] = [];
    const search = heading.trim().toLowerCase();

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);

        if (!collecting) {
            if (match) {
                const level = match[1].length;
                const title = match[2].trim().toLowerCase();
                if (title === search) {
                    targetLevel = level;
                    collecting = true;
                    continue; // пропускаем строку заголовка
                }
            }
        } else {
            if (match) {
                const level = match[1].length;
                if (level <= targetLevel) {
                    break; // новый заголовок того же или выше уровня
                }
            }
            result.push(rawLine);
        }
    }

    return collecting ? result.join("\n").trimStart() : null;
}