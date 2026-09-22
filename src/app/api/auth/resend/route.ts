import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/authErrors";

/**
 * Повторная отправка кода подтверждения. Без этого потерянное письмо
 * означает тупик: аккаунт уже создан, зарегистрироваться заново нельзя,
 * а войти без подтверждения не выйдет.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;

  if (!email) {
    return NextResponse.json({ error: "Укажите почту" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error) {
    return NextResponse.json(
      {
        error: translateAuthError(
          error.message,
          "Не удалось отправить письмо. Попробуйте позже.",
        ),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
