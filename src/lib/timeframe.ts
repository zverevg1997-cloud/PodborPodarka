export type Urgency = "today" | "soon" | "later";

/**
 * Насколько срочно нужен подарок.
 *
 * Поле в анкете свободное: «сегодня», «завтра», «через неделю», «к 8 марта».
 * Нам достаточно грубого деления — от него зависит, куда вести человека:
 * заказывать на маркетплейсе или искать в магазинах своего города.
 */
export function parseUrgency(raw?: string | null): Urgency {
  if (!raw) return "later";

  const text = raw.toLowerCase().replace(/ /g, " ");

  // Сегодня и срочно — доставка не успеет, нужен магазин рядом.
  if (/сегодн|сейчас|срочн|через час|в течение дня|пару часов/.test(text)) {
    return "today";
  }

  if (/завтра|послезавтра|за день|к утру|на днях/.test(text)) {
    return "soon";
  }

  // «через 1–2 дня» тоже считаем срочным: обычная доставка не всегда успеет.
  const days = text.match(/через\s+(\d+)\s*(?:дн|день|дня|дней)/);
  if (days && Number(days[1]) <= 2) return "soon";

  return "later";
}

/**
 * Значение фильтра доставки на Яндекс Маркете.
 * Проверено вручную: 0 — сегодня, 1 — сегодня-завтра, 3 — до трёх дней.
 * Остальные числа Маркет молча игнорирует и показывает выдачу без фильтра.
 */
export function marketDeliveryInterval(urgency: Urgency): number | undefined {
  if (urgency === "today") return 0;
  if (urgency === "soon") return 1;
  return undefined;
}

/**
 * Города, где у Маркета есть доставка в день заказа.
 *
 * Список намеренно короткий. Экспресс работает и в других крупных городах,
 * но если ошибиться и включить город, где его нет, человек увидит пустую
 * выдачу — а это хуже, чем ссылка на магазины рядом.
 */
const EXPRESS_CITIES = [
  "москва",
  "московск",
  "санкт-петербург",
  "петербург",
  "спб",
  "ленинградск",
];

export function hasExpressDelivery(city?: string | null): boolean {
  if (!city) return false;
  const normalized = city.toLowerCase().replace(/ё/g, "е");
  return EXPRESS_CITIES.some((name) => normalized.includes(name));
}

/**
 * Нужно ли вести человека в магазины города вместо маркетплейса.
 * Срочно — и при этом доставка в день заказа тут не работает.
 */
export function needsLocalPurchase(
  urgency: Urgency,
  city?: string | null,
): boolean {
  return urgency === "today" && !hasExpressDelivery(city);
}
