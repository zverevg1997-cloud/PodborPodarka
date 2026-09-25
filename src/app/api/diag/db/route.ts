import { connect } from "node:net";
import { NextRequest, NextResponse } from "next/server";

/**
 * Временная проверка: достаёт ли приложение базу по внутреннему адресу.
 *
 * Нужна, чтобы закрыть базу снаружи безопасно. Сейчас она доступна из
 * интернета — так в неё заливали данные при переезде, — и это стоит убрать.
 * Но если внутренняя сеть между приложением и базой не работает, отключение
 * внешнего адреса положит сайт целиком. Сначала проверяем, потом отключаем.
 *
 * Удалить, как только вопрос закроется.
 */
function probe(host: string, port: number): Promise<string> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port, timeout: 5000 });

    socket.on("connect", () => {
      socket.destroy();
      resolve(`соединение есть, ${Date.now() - started} мс`);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve("таймаут");
    });
    socket.on("error", (error) => {
      socket.destroy();
      resolve(String(error.message));
    });
  });
}

export async function GET(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const [local, external] = await Promise.all([
    probe("192.168.0.4", 5432),
    probe("147.45.153.3", 5432),
  ]);

  return NextResponse.json({
    "внутренний 192.168.0.4:5432": local,
    "внешний 147.45.153.3:5432": external,
  });
}
