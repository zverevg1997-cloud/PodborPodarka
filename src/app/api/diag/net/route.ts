import { NextRequest, NextResponse } from "next/server";

/**
 * Временная диагностика исходящей связи с сервера.
 *
 * Понадобилась, когда выяснилось, что до api.telegram.org с прода не
 * достучаться: надо понять, закрыт путь только до телеграма или наружу
 * вообще. Удалить, как только вопрос закроется.
 */
export const maxDuration = 60;

const HOSTS = [
  "https://api.telegram.org",
  "https://core.telegram.org",
  "https://cloudflare.com",
  "https://api.anthropic.com",
  "https://www.google.com",
  "https://api.github.com",
  "https://ya.ru",
  "https://go2.unisender.ru",
];

export async function GET(request: NextRequest) {
  // Открытый доступ к такому эндпоинту превращает сервер в сканер портов
  // для кого угодно, поэтому закрываем тем же секретом, что и вебхук.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const results = await Promise.all(
    HOSTS.map(async (url) => {
      const started = Date.now();
      try {
        const res = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
        });
        return { url, ok: true, status: res.status, ms: Date.now() - started };
      } catch (error) {
        const cause = (error as { cause?: unknown })?.cause;
        return {
          url,
          ok: false,
          error: String(cause ?? error).slice(0, 120),
          ms: Date.now() - started,
        };
      }
    }),
  );

  return NextResponse.json({ results });
}
