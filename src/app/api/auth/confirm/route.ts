import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCode, verifyErrorText } from "@/lib/emailCode";
import { createSession } from "@/lib/session";
import { claimGuestProfiles } from "@/lib/guest";

/**
 * Подтверждение почты кодом из письма.
 *
 * В письме именно код, а не ссылка: Unisender заворачивает ссылки в свой
 * трекер, переход занимал десятки секунд, а иногда обрывался по таймауту.
 * Код такой обёртки не требует — заворачивать нечего.
 *
 * После успеха человек сразу залогинен: заставлять его вводить пароль
 * второй раз подряд незачем.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";
  const code: string = body?.token?.toString().trim() ?? "";

  if (!email || !code) {
    return NextResponse.json(
      { error: "Введите код из письма" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "Код неверный или устарел. Запросите новый." },
      { status: 400 },
    );
  }

  const result = await verifyCode(user.id, code, "confirm");

  if (!result.ok) {
    return NextResponse.json(
      { error: verifyErrorText(result.reason) },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailConfirmedAt: new Date() },
  });

  await createSession(user.id);

  // Всё, что человек успел сделать гостем, переносим на новый аккаунт:
  // иначе он зарегистрируется и обнаружит пустой кабинет.
  const claimed = await claimGuestProfiles(user.id);

  return NextResponse.json({ ok: true, claimedProfiles: claimed });
}
