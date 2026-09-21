import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;
  const phone: string | undefined = body?.phone;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Не удалось зарегистрироваться" },
      { status: 400 },
    );
  }

  const user = await prisma.user.upsert({
    where: { id: data.user.id },
    update: { email, phone },
    create: { id: data.user.id, email, phone },
  });

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, phone: user.phone },
      // Если в проекте Supabase включено подтверждение email,
      // сессия появится только после перехода по ссылке из письма.
      session: Boolean(data.session),
    },
    { status: 201 },
  );
}
