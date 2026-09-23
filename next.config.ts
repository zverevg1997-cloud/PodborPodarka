import type { NextConfig } from "next";
import { SITE_URL } from "./src/lib/site";

/**
 * daribot.ru — почтовый домен, сайта на нём нет. Раньше редирект на основной
 * домен делал Vercel, после переезда его нужно было чем-то заменить.
 * Держим правило в приложении: оно переживёт следующую смену хостинга и
 * не зависит от того, что умеет панель провайдера.
 *
 * Важно: DNS-записи домена daribot.ru трогать нельзя, кроме A — там живут
 * MX, SPF, DKIM и DMARC, на которых держится отправка писем.
 */
// www.дарибот.рф здесь же: имя привязано к приложению и отвечает тем же
// сайтом, то есть без редиректа поисковик видит два одинаковых сайта и делит
// вес между ними. Хост в заголовке запроса приходит в punycode, кириллицу
// сравнивать бесполезно.
const REDIRECT_FROM = [
  "daribot.ru",
  "www.daribot.ru",
  "www.xn--80achr5ajr.xn--p1ai",
];

const nextConfig: NextConfig = {
  async redirects() {
    return REDIRECT_FROM.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${SITE_URL}/:path*`,
      // Именно 301, а не 308, который Next ставит при permanent: true.
      // По этому редиректу Яндекс склеивает зеркала, и в его документации
      // про переезд описан 301 — рисковать ради одной цифры незачем.
      statusCode: 301,
    }));
  },
};

export default nextConfig;
