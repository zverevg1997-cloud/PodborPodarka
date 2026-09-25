import { connect } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Временная проверка сети между приложением и базой.
 *
 * Нужна, чтобы закрыть базу снаружи безопасно. Сейчас она доступна из
 * интернета — так в неё заливали данные при переезде, — и это стоит убрать.
 * Но приложение ходит в неё по тому же внешнему адресу, а внутренняя сеть
 * между ними не работает, поэтому просто отключить адрес нельзя.
 *
 * Удалить, как только фаервол будет настроен.
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

  // С какого адреса приложение приходит в базу — так его видит сам Postgres.
  // Без этой цифры нельзя составить правило фаервола: ошибёмся адресом, и
  // приложение потеряет базу вместе с сайтом.
  let clientAddr = "не определился";
  try {
    const rows = await prisma.$queryRawUnsafe<{ addr: string | null }[]>(
      "select host(inet_client_addr()) as addr",
    );
    clientAddr = rows[0]?.addr ?? "пусто";
  } catch (error) {
    clientAddr = String((error as Error).message).split("\n")[0];
  }

  return NextResponse.json({
    "внутренний 192.168.0.4:5432": local,
    "внешний 147.45.153.3:5432": external,
    "приложение приходит в базу с адреса": clientAddr,
  });
}
