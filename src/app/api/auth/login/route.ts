import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { claimGuestProfiles } from "@/lib/guest";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";
  const password: string = body?.password?.toString() ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Один и тот же текст и при неизвестной почте, и при неверном пароле:
  // иначе форма превращается в способ узнать, кто у нас зарегистрирован.
  const wrong = NextResponse.json(
    { error: "Неверная почта или пароль" },
    { status: 401 },
  );

  if (!user) return wrong;
  if (!(await verifyPassword(password, user.passwordHash))) return wrong;

  if (!user.emailConfirmedAt) {
    return NextResponse.json(
      {
        error:
          "Почта не подтверждена. Мы отправляли код при регистрации — введите его или запросите новый.",
      },
      { status: 403 },
    );
  }

  await createSession(user.id);

  // Человек мог сделать подбор гостем, а потом войти в старый аккаунт —
  // забирать гостевые профили нужно и здесь, не только при регистрации.
  await claimGuestProfiles(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, phone: user.phone },
  });
}
