import { NextRequest, NextResponse } from "next/server";
import { handleCallback, handleMessage } from "@/lib/telegram/dialog";

// Подбор идей занимает несколько секунд — не даём оборвать обработку рано.
export const maxDuration = 60;

/**
 * Точка входа телеграма. Он шлёт сюда каждое сообщение и каждое нажатие
 * кнопки обычным POST-запросом.
 *
 * Отвечаем сразу, а работу делаем следом, не дожидаясь её в ответе. Телеграм
 * считает обновление необработанным, пока не получит ответ, и через несколько
 * секунд присылает его заново — при подборе на пять секунд человек получил бы
 * три одинаковых подборки.
 */
export async function POST(request: NextRequest) {
  // Секрет телеграм присылает в заголовке при каждом запросе. Без проверки
  // любой, кто знает адрес, мог бы слать боту поддельные сообщения.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  void handleUpdate(update).catch((error) => {
    console.error("telegram: обработка обновления не удалась", error);
  });

  return NextResponse.json({ ok: true });
}

interface Update {
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

async function handleUpdate(update: Update): Promise<void> {
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
