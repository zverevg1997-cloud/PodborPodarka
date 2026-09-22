import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATIONS_PER_IP,
  checkRegistrationLimit,
  getClientIp,
} from "@/lib/rateLimit";
import { resolveBaseUrl } from "@/lib/site";

export async function POST(request: NextRequest) {
  // Лимит проверяем до разбора тела: смысл в том, чтобы отсечь поток запросов
  // как можно раньше, ещё до обращений к Supabase.
  const { allowed } = await checkRegistrationLimit(getClientIp(request));
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          `Слишком много попыток регистрации. Можно создать не больше ` +
          `${REGISTRATIONS_PER_IP} аккаунтов в час — попробуйте позже.`,
      },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;
  const phone: string | undefined = body?.phone;
  const acceptTerms: boolean = body?.acceptTerms === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 },
    );
  }

  // Галочку проверяем и на сервере: без согласия у нас нет правового
  // основания обрабатывать данные, а форму можно обойти в обход браузера.
  if (!acceptTerms) {
    return NextResponse.json(
      {
        error:
          "Примите пользовательское соглашение и согласие на обработку данных",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Без этого Supabase вернёт человека на site_url, то есть на главную,
    // где обменивать code на сессию некому.
    options: {
      emailRedirectTo: `${resolveBaseUrl(request.url)}/auth/callback`,
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Не удалось зарегистрироваться" },
      { status: 400 },
    );
  }

  // Supabase намеренно не раскрывает, что адрес уже занят: вместо ошибки он
  // возвращает пользователя со случайным id и пустым identities. Без этой
  // проверки upsert ниже пытался создать вторую строку с тем же email, падал
  // на уникальном индексе и отдавал HTML-страницу ошибки вместо JSON —
  // форма на сайте после этого зависала в состоянии «Создаём аккаунт…».
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return NextResponse.json(
      {
        error:
          "Аккаунт с такой почтой уже существует. Войдите или восстановите пароль.",
      },
      { status: 409 },
    );
  }

  let user;
  try {
    user = await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email, phone },
      create: { id: data.user.id, email, phone },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Аккаунт с такой почтой уже существует. Войдите или восстановите пароль.",
        },
        { status: 409 },
      );
    }
    // Любую другую ошибку тоже отдаём как JSON: клиент разбирает ответ через
    // res.json(), и HTML-страница ошибки сломала бы ему обработку.
    console.error("register: не удалось создать пользователя", e);
    return NextResponse.json(
      { error: "Не удалось создать аккаунт. Попробуйте ещё раз." },
      { status: 500 },
    );
  }

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
