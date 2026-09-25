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

/** Пауза между попытками. Связь с телеграмом рвётся через раз. */
const RETRY_PAUSE_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Обращение к API. Никогда не бросает исключение и никогда не роняет
 * вызывающий код.
 *
 * Причина: путь до телеграма с российского сервера нестабилен, соединение
 * не устанавливается через раз. Раньше первое же неудачное обращение
 * обрывало обработку нажатия целиком — человек нажимал кнопку и не получал
 * ничего, потому что падала попытка погасить «часики» на ней.
 *
 * Повторяем только сетевые сбои. Ошибку самого API повторять бессмысленно:
 * она не станет другой от второй попытки.
 */
async function call(
  method: string,
  body: unknown,
  attempts = 3,
): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !(data as { ok?: boolean })?.ok) {
        console.error(`telegram ${method}:`, JSON.stringify(data)?.slice(0, 300));
        return null;
      }

      return data;
    } catch (error) {
      if (attempt === attempts) {
        const cause = (error as { cause?: unknown })?.cause;
        console.error(
          `telegram ${method}: связь не установилась после ${attempts} попыток`,
          String(cause ?? error).slice(0, 160),
        );
        return null;
      }
      await sleep(RETRY_PAUSE_MS);
    }
  }

  return null;
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
  return call("sendChatAction", { chat_id: chatId, action: "typing" }, 1);
}

/**
 * Гасит «часики» на нажатой кнопке. Без ответа телеграм показывает их
 * несколько секунд, и нажатие выглядит как зависшее.
 */
export function answerCallback(
  callbackQueryId: string,
  text?: string,
): Promise<unknown> {
  return call(
    "answerCallbackQuery",
    { callback_query_id: callbackQueryId, ...(text ? { text } : {}) },
    1,
  );
}

/** Убирает кнопки у прежнего сообщения, чтобы на них нельзя было нажать дважды. */
export function clearKeyboard(
  chatId: string,
  messageId: number,
): Promise<unknown> {
  return call(
    "editMessageReplyMarkup",
    { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } },
    1,
  );
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

/**
 * Пост с картинкой. Подпись ограничена 1024 знаками — это ограничение
 * телеграма, а не наше, и длинный текст придётся слать отдельно.
 */
export function sendPhoto(
  chatId: string,
  photo: string,
  caption: string,
): Promise<unknown> {
  return call("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML" });
}

/**
 * Скачивает файл, присланный боту.
 *
 * Нужно, чтобы переложить картинку из телеграма во ВКонтакте: там file_id
 * телеграма ничего не значит, нужны сами байты. Путь до файла идёт через
 * того же посредника, что и остальные запросы, — прямой до телеграма с
 * нашего сервера не работает.
 */
export async function getFileBytes(fileId: string): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const info = (await call("getFile", { file_id: fileId })) as {
    result?: { file_path?: string };
  } | null;

  const path = info?.result?.file_path;
  if (!path) return null;

  try {
    const res = await fetch(`${API_BASE}/file/bot${token}/${path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    console.error("telegram getFile: не скачался", String(error).slice(0, 160));
    return null;
  }
}
