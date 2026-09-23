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

/** Успеет ли обычная доставка с маркетплейса. */
export function needsLocalPurchase(urgency: Urgency): boolean {
  return urgency === "today";
}
