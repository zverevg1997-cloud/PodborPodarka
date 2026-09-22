import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveBaseUrl } from "@/lib/site";

/**
 * Куда Supabase возвращает человека после перехода по ссылке из письма.
 *
 * Регистрация идёт по схеме PKCE: ссылка подтверждения приводит сюда с
 * параметром code, и его нужно обменять на сессию. Без этого обмена почта
 * подтверждается, но человек остаётся разлогиненным и попадает на главную
 * с непонятным ?code= в адресе.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = resolveBaseUrl(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${base}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Обычно это значит, что ссылку открыли в другом браузере или на другом
    // устройстве: там нет code verifier, сохранённого при регистрации.
    // Почта при этом уже подтверждена, так что достаточно обычного входа.
    return NextResponse.redirect(`${base}/login?confirmed=1`);
  }

  return NextResponse.redirect(`${base}/search`);
}
