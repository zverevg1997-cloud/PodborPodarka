import { NextResponse } from "next/server";
import {
  authorizeUrl,
  createChallenge,
  isVkLoginConfigured,
  VK_COOKIE_TTL_SECONDS,
  VK_STATE_COOKIE,
  VK_VERIFIER_COOKIE,
} from "@/lib/vkAuth";
import { SITE_URL } from "@/lib/site";

/** Начало входа через ВКонтакте: придумываем секрет и уводим на согласие. */
export async function GET() {
  if (!isVkLoginConfigured()) {
    return NextResponse.redirect(`${SITE_URL}/login?error=vk`);
  }

  const { verifier, challenge, state } = createChallenge();
  const response = NextResponse.redirect(authorizeUrl(challenge, state));

  // Секрет кладём в куку, недоступную скриптам страницы: он нужен только
  // нашему же обработчику возврата и больше никому.
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: VK_COOKIE_TTL_SECONDS,
  };

  response.cookies.set(VK_VERIFIER_COOKIE, verifier, options);
  response.cookies.set(VK_STATE_COOKIE, state, options);

  return response;
}
