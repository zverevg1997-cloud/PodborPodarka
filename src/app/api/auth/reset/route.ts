import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCode, verifyErrorText } from "@/lib/emailCode";
import { hashPassword, validatePassword } from "@/lib/password";
import { createSession, destroyAllSessions } from "@/lib/session";

/**
 * Смена пароля по коду из письма.
 *
 * Все прежние сессии завершаем: если пароль меняют потому, что к аккаунту
 * получил доступ посторонний, оставить ему действующую сессию — значит не
 * сделать ничего.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";
  const code: string = body?.token?.toString().trim() ?? "";
  const password: string = body?.password?.toString() ?? "";

  if (!email || !code || !password) {
    return NextResponse.json(
      { error: "Введите код из письма и новый пароль" },
      { status: 400 },
    );
  }

  const weak = validatePassword(password, email);
  if (weak) {
    return NextResponse.json({ error: weak }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "Код неверный или устарел. Запросите новый." },
      { status: 400 },
    );
  }

  const result = await verifyCode(user.id, code, "reset");

  if (!result.ok) {
    return NextResponse.json(
      { error: verifyErrorText(result.reason) },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      // Раз человек получил письмо, адрес точно его — подтверждаем заодно.
      emailConfirmedAt: user.emailConfirmedAt ?? new Date(),
    },
  });

  await destroyAllSessions(user.id);
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
