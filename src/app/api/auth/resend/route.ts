import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueCode } from "@/lib/emailCode";
import { codeEmail, sendEmail } from "@/lib/mail";

/**
 * Повторная отправка кода подтверждения. Без этого потерянное письмо
 * означает тупик: аккаунт уже создан, зарегистрироваться заново нельзя,
 * а войти без подтверждения не выйдет.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Укажите почту" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Неизвестный или уже подтверждённый адрес — отвечаем так же, как в
  // успешном случае. Иначе форма подсказывает, кто у нас зарегистрирован.
  if (!user || user.emailConfirmedAt) {
    return NextResponse.json({ ok: true });
  }

  const issued = await issueCode(user.id, "confirm");

  if (!issued.ok) {
    return NextResponse.json(
      {
        error: `Письмо только что отправлено. Подождите ${issued.secondsLeft} с и попробуйте снова.`,
      },
      { status: 429 },
    );
  }

  const letter = codeEmail(issued.code, "confirm");
  const sent = await sendEmail({ to: email, ...letter });

  if (!sent.ok) {
    console.error("resend: письмо не ушло", sent.error);
    return NextResponse.json(
      { error: "Не удалось отправить письмо. Попробуйте позже." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
