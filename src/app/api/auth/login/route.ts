import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { translateAuthError } from "@/lib/authErrors";
import { claimGuestProfiles } from "@/lib/guest";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      {
        error: translateAuthError(error?.message, "Неверная почта или пароль"),
      },
      { status: 401 },
    );
  }

  // На случай, если строка пользователя ещё не была создана в Prisma
  // (например, пользователь был создан напрямую в Supabase).
  let user;
  try {
    user = await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email },
      create: { id: data.user.id, email },
    });
  } catch (e) {
    // Случается, если аккаунт удалили в Supabase, а строка с тем же email
    // осталась у нас: id новый, email занят прежней строкой. Раньше это
    // выдавало 500 с HTML вместо ответа — теперь хотя бы внятный JSON.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      console.error("login: конфликт email в таблице users", email);
      return NextResponse.json(
        {
          error:
            "С этим адресом что-то не так на нашей стороне. Напишите нам, мы починим.",
        },
        { status: 409 },
      );
    }
    console.error("login: не удалось получить пользователя", e);
    return NextResponse.json(
      { error: "Не удалось войти. Попробуйте ещё раз." },
      { status: 500 },
    );
  }

  // Человек мог сделать подбор гостем, а потом войти в старый аккаунт —
  // забирать гостевые профили нужно и здесь, не только при регистрации.
  await claimGuestProfiles(user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email, phone: user.phone },
  });
}
