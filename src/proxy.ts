import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// /search и /results намеренно открыты: первый подбор доступен без аккаунта,
// иначе человек упирается в регистрацию раньше, чем поймёт, зачем она ему.
// Доступ к чужим результатам ограничивает сама страница, сверяя владельца.
const PROTECTED_PATHS = ["/profile"];

/**
 * Здесь только наличие куки — в базу не ходим. Смысл этой проверки в том,
 * чтобы не показывать пустой кабинет тому, кто не вошёл; настоящая проверка
 * сессии идёт на самой странице, через getCurrentUser. Запрос к базе на
 * каждый переход по сайту ради редиректа того не стоит.
 */
export function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtected && !request.cookies.get(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
