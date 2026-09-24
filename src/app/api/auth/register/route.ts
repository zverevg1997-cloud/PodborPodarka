import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATIONS_PER_IP,
  checkRegistrationLimit,
  getClientIp,
} from "@/lib/rateLimit";
import { hashPassword, validatePassword } from "@/lib/password";
import { issueCode } from "@/lib/emailCode";
import { codeEmail, sendEmail } from "@/lib/mail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Лимит проверяем до разбора тела: смысл в том, чтобы отсечь поток запросов
  // как можно раньше, ещё до обращений к базе.
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
  const email: string = body?.email?.toString().trim().toLowerCase() ?? "";
  const password: string = body?.password?.toString() ?? "";
  const phone: string | undefined = body?.phone?.toString().trim() || undefined;
  const acceptTerms: boolean = body?.acceptTerms === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 },
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Проверьте адрес почты: похоже, в нём опечатка" },
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

  const weak = validatePassword(password, email);
  if (weak) {
    return NextResponse.json({ error: weak }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.emailConfirmedAt) {
    return NextResponse.json(
      {
        error:
          "Аккаунт с такой почтой уже существует. Войдите или восстановите пароль.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  // Незавершённая регистрация — не повод отправлять человека в тупик:
  // аккаунт есть, войти в него нельзя, зарегистрироваться заново тоже.
  // Перезаписываем пароль и высылаем код повторно.
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, phone },
      })
    : await prisma.user.create({ data: { email, passwordHash, phone } });

  const issued = await issueCode(user.id, "confirm");

  // Отказ по частоте здесь не ошибка: код отправлен минуту назад и всё ещё
  // действует. Человеку показываем ту же форму ввода кода.
  if (issued.ok) {
    const letter = codeEmail(issued.code, "confirm");
    const sent = await sendEmail({ to: email, ...letter });

    if (!sent.ok) {
      console.error("register: письмо не ушло", sent.error);
      return NextResponse.json(
        {
          error:
            "Не удалось отправить письмо на этот адрес. Проверьте его или напишите нам.",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, phone: user.phone },
      // Сессии пока нет: сначала подтверждение почты.
      session: false,
    },
    { status: 201 },
  );
}
