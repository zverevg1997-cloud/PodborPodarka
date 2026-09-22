import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { translateAuthError } from "@/lib/authErrors";

/**
 * Подтверждение почты кодом из письма.
 *
 * Раньше в письме была ссылка, но Unisender заворачивал её в свой трекер:
 * переход занимал десятки секунд, а иногда обрывался по таймауту. Код такой
 * обёртки не требует — заворачивать нечего.
 *
 * verifyOtp выдаёт сессию, поэтому после успеха человек сразу залогинен.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const token: string | undefined = body?.token?.toString().trim();

  if (!email || !token) {
    return NextResponse.json(
      { error: "Введите код из письма" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error || !data.user) {
    return NextResponse.json(
      {
        error: translateAuthError(
          error?.message,
          "Код неверный или устарел. Запросите новый.",
        ),
      },
      { status: 400 },
    );
  }

  // Строку пользователя создаёт /api/auth/register, но если письмо
  // подтверждают спустя время, лишняя проверка не помешает.
  try {
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email },
      create: { id: data.user.id, email },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      console.error("confirm: конфликт email в таблице users", email);
    } else {
      console.error("confirm: не удалось сохранить пользователя", e);
      return NextResponse.json(
        { error: "Почта подтверждена, но войти не удалось. Попробуйте войти вручную." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
