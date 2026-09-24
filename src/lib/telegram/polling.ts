import { handleCallback, handleMessage } from "@/lib/telegram/dialog";

/**
 * Забираем сообщения у телеграма сами, вместо того чтобы он приходил к нам.
 *
 * Обычный способ — вебхук: телеграм сам стучится на наш адрес. Но защита
 * Timeweb отбрасывает соединения с его серверов, и вебхук возвращал
 * «Connection timed out». Исходящие соединения при этом работают, поэтому
 * ходим за обновлениями сами. Заодно это снимает зависимость от того, доступен
 * ли наш адрес снаружи вообще.
 *
 * Запрос висит до тридцати секунд и возвращается, как только появится
 * сообщение, — это не опрос в цикле, а длинное ожидание. Нагрузки почти нет.
 */

const API_BASE =
  process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

/** Сколько телеграм держит запрос, ожидая сообщений. */
const LONG_POLL_SECONDS = 30;

/** Пауза после ошибки сети, чтобы не долбить телеграм в цикле. */
const ERROR_PAUSE_MS = 5000;

interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

let running = false;

async function call(token: string, method: string, body: unknown) {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Чуть больше, чем ждёт сам телеграм: иначе рвём соединение раньше него.
    signal: AbortSignal.timeout((LONG_POLL_SECONDS + 15) * 1000),
  });
  return res.json();
}

async function dispatch(update: Update): Promise<void> {
  if (update.callback_query?.data && update.callback_query.message) {
    await handleCallback(
      String(update.callback_query.message.chat.id),
      update.callback_query.message.message_id,
      update.callback_query.data,
      update.callback_query.id,
    );
    return;
  }

  if (update.message?.text) {
    await handleMessage(String(update.message.chat.id), update.message.text);
  }
}

export async function startPolling(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  if (running) return;
  running = true;

  // Телеграм не отдаёт обновления, пока зарегистрирован вебхук. Снимаем его,
  // иначе getUpdates будет отвечать ошибкой 409 на каждый запрос.
  await call(token, "deleteWebhook", { drop_pending_updates: false }).catch(
    () => {},
  );

  console.log("telegram: слушаю обновления");

  let offset = 0;

  // Бесконечный цикл намеренный: он живёт столько же, сколько контейнер.
  for (;;) {
    try {
      const data = (await call(token, "getUpdates", {
        offset,
        timeout: LONG_POLL_SECONDS,
        allowed_updates: ["message", "callback_query"],
      })) as { ok?: boolean; result?: Update[]; description?: string };

      if (!data?.ok) {
        console.error("telegram getUpdates:", data?.description);
        await new Promise((r) => setTimeout(r, ERROR_PAUSE_MS));
        continue;
      }

      for (const update of data.result ?? []) {
        // Сдвигаем счётчик до обработки: если она упадёт, обновление не
        // придёт заново и человек не получит три одинаковых ответа.
        offset = update.update_id + 1;

        await dispatch(update).catch((error) => {
          console.error("telegram: обработка обновления не удалась", error);
        });
      }
    } catch (error) {
      // Обрыв длинного запроса по таймауту — обычное дело, не ошибка.
      const message = String(error);
      if (!message.includes("TimeoutError")) {
        const cause = (error as { cause?: unknown })?.cause;
        console.error(
          "telegram: опрос прервался",
          message,
          cause ? `| причина: ${String(cause)}` : "",
        );
      }
      await new Promise((r) => setTimeout(r, ERROR_PAUSE_MS));
    }
  }
}
