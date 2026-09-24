import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueCode } from "@/lib/emailCode";
import { codeEmail, sendEmail } from "@/lib/mail";

/**
 * Запрос кода для смены пароля.
 *
 * Ответ всегда одинаковый, даже если такого адреса у нас нет: иначе форма
 * становится способом проверить, зарегистрирован ли человек на сервисе.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Укажите почту" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const issued = await issueCode(user.id, "reset");

    if (issued.ok) {
      const letter = codeEmail(issued.code, "reset");
      const sent = await sendEmail({ to: email, ...letter });
      if (!sent.ok) {
        console.error("forgot: письмо не ушло", sent.error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
