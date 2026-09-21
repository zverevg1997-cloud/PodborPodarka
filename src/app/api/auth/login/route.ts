import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
      { error: error?.message ?? "Неверный email или пароль" },
      { status: 401 },
    );
  }

  // На случай, если строка пользователя ещё не была создана в Prisma
  // (например, пользователь был создан напрямую в Supabase).
  const user = await prisma.user.upsert({
    where: { id: data.user.id },
    update: { email },
    create: { id: data.user.id, email },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, phone: user.phone },
  });
}
