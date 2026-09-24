/**
 * Тонкая обёртка над Bot API телеграма. Библиотеку не берём: нам нужны
 * четыре метода, а любая из них тянет за собой свой способ хранить
 * состояние и свой роутер, которые здесь только мешали бы.
 */

const API_BASE =
  process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

export interface InlineButton {
  text: string;
  /** Кнопка-ссылка: уводит наружу, например на Маркет. */
  url?: string;
  /** Кнопка-действие: возвращается к нам в обработчик. */
  callback_data?: string;
}

/** Ряды кнопок под сообщением. */
export type InlineKeyboard = InlineButton[][];

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function call(method: string, body: unknown): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !(data as { ok?: boolean })?.ok) {
    // Не бросаем исключение выше: одно неотправленное сообщение не должно
    // рушить обработку обновления целиком — иначе телеграм будет слать его
    // снова и снова, и человек получит десять одинаковых ответов.
    console.error(`telegram ${method}:`, JSON.stringify(data)?.slice(0, 300));
  }

  return data;
}

export function sendMessage(
  chatId: string,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<unknown> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    // Превью ссылок в подборке из шести идей превратило бы сообщение в
    // простыню картинок.
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

/**
 * «Печатает…» под названием бота. Подбор идей занимает несколько секунд, и
 * без этого человек успевает решить, что бот сломался.
 */
export function sendTyping(chatId: string): Promise<unknown> {
  return call("sendChatAction", { chat_id: chatId, action: "typing" });
}

/**
 * Гасит «часики» на нажатой кнопке. Без ответа телеграм показывает их
 * несколько секунд, и нажатие выглядит как зависшее.
 */
export function answerCallback(
  callbackQueryId: string,
  text?: string,
): Promise<unknown> {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/** Убирает кнопки у прежнего сообщения, чтобы на них нельзя было нажать дважды. */
export function clearKeyboard(
  chatId: string,
  messageId: number,
): Promise<unknown> {
  return call("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

/**
 * Привязывает бота к нашему адресу. Вызывается один раз вручную после
 * получения токена — телеграм сам никуда не придёт, пока ему не сказать.
 */
export function setWebhook(url: string, secret: string): Promise<unknown> {
  return call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}
