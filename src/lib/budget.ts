export interface PriceRange {
  from?: number;
  to?: number;
}

/**
 * Разбирает бюджет из анкеты в числовой диапазон.
 *
 * Поле свободное, люди пишут как придётся: «до 8000 рублей», «3000-5000»,
 * «около 5 тысяч». Нужно это для ссылки на Маркет: сама модель цен не знает
 * и уложиться в бюджет может только на глаз, а поиск с фильтром — может.
 *
 * Если разобрать не вышло, возвращаем пустой диапазон: лучше ссылка без
 * фильтра, чем с выдуманными границами.
 */
export function parseBudget(raw?: string | null): PriceRange {
  if (!raw) return {};

  const text = raw.toLowerCase().replace(/ /g, " ");

  // «5 тыс», «5 тысяч» → 5000. Иначе фильтр получил бы границу в 5 рублей.
  const normalized = text.replace(
    /(\d+(?:[.,]\d+)?)\s*(?:тыс(?:\.|яч[аи]?)?|к\b)/g,
    (_m, n: string) => String(Math.round(parseFloat(n.replace(",", ".")) * 1000)),
  );

  const numbers = (normalized.match(/\d[\d\s]*/g) ?? [])
    .map((n) => Number(n.replace(/\s/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 10_000_000);

  if (numbers.length === 0) return {};

  if (numbers.length >= 2) {
    const [a, b] = numbers;
    return { from: Math.min(a, b), to: Math.max(a, b) };
  }

  const value = numbers[0];

  // Границу слова через \b здесь использовать нельзя: в JavaScript она
  // опирается на латиницу, и «от» в русском тексте ею не находится.
  const hasWord = (word: string) =>
    new RegExp(`(^|[^а-яё])${word}([^а-яё]|$)`).test(normalized);

  if (hasWord("от") && !hasWord("до")) {
    return { from: value };
  }

  // Одно число почти всегда означает потолок: «до 3000», «3000», «бюджет 3000».
  return { to: value };
}
