import { SITE_DOMAIN, SITE_NAME } from "@/lib/site";

/**
 * Отправка писем через HTTP API Unisender Go.
 *
 * Именно API, а не SMTP: Timeweb закрывает исходящие порты 25, 465 и 587,
 * так что почтовый порт из приложения недоступен. API к тому же отвечает
 * сразу и возвращает идентификатор письма — по нему потом видно в логах,
 * что стало с конкретной отправкой.
 */
const API_BASE =
  process.env.UNISENDER_API_BASE ?? "https://go2.unisender.ru/ru/transactional/api/v1";

const FROM_EMAIL = process.env.MAIL_FROM_EMAIL ?? "noreply@daribot.ru";

interface SendResult {
  ok: boolean;
  /** Что именно пошло не так — для логов, не для показа человеку. */
  error?: string;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.UNISENDER_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "UNISENDER_API_KEY не задан" };
  }

  try {
    const res = await fetch(`${API_BASE}/email/send.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        message: {
          recipients: [{ email: options.to }],
          subject: options.subject,
          body: { html: options.html, plaintext: options.text },
          from_email: FROM_EMAIL,
          from_name: SITE_NAME,
        },
      }),
      // Письмо не должно держать запрос пользователя дольше нескольких секунд.
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || data?.status === "error") {
      return {
        ok: false,
        error: `Unisender ${res.status}: ${JSON.stringify(data)?.slice(0, 300)}`,
      };
    }

    // Адрес мог попасть в список недоставляемых — письмо принято, но не уйдёт.
    const failed = data?.failed_emails;
    if (failed && Object.keys(failed).length > 0) {
      return { ok: false, error: `Адрес отклонён: ${JSON.stringify(failed)}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Не удалось обратиться к Unisender: ${e}` };
  }
}

/**
 * Письмо с кодом. Ссылок внутри нет намеренно: Unisender заворачивает их в
 * свой трекер, переход занимал десятки секунд и иногда обрывался по таймауту.
 * Код переписывают руками, заворачивать нечего.
 */
export function codeEmail(code: string, purpose: "confirm" | "reset") {
  const title =
    purpose === "confirm" ? "Подтверждение почты" : "Восстановление пароля";

  const lead =
    purpose === "confirm"
      ? `Вы указали эту почту при регистрации на ${SITE_DOMAIN}. Введите код, чтобы завершить регистрацию:`
      : `Вы запросили восстановление пароля на ${SITE_DOMAIN}. Введите код, чтобы задать новый:`;

  const ignore =
    purpose === "confirm"
      ? "Если вы не регистрировались, просто удалите это письмо."
      : "Если вы не запрашивали смену пароля, просто удалите это письмо — пароль останется прежним.";

  const text = `${lead}\n\n${code}\n\nКод действует 30 минут.\n\n${ignore}\n\n${SITE_NAME} — ${SITE_DOMAIN}`;

  const html = `<!doctype html>
<html lang="ru"><body style="margin:0;padding:24px;background:#faf7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2430">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px">${title}</h1>
    <p style="margin:0 0 24px;line-height:1.5;color:#5b5360">${lead}</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#faf7f5;border-radius:12px">${code}</div>
    <p style="margin:24px 0 0;line-height:1.5;color:#5b5360;font-size:14px">Код действует 30 минут.</p>
    <p style="margin:8px 0 0;line-height:1.5;color:#8b8390;font-size:13px">${ignore}</p>
    <p style="margin:24px 0 0;color:#8b8390;font-size:13px">${SITE_NAME} — ${SITE_DOMAIN}</p>
  </div>
</body></html>`;

  return { subject: `${title} — ${SITE_NAME}`, html, text };
}
