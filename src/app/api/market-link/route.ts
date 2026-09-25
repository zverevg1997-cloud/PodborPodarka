import { NextRequest, NextResponse } from "next/server";
import {
  buildYandexMarketSearchUrl,
  createYandexMarketAffiliateLink,
} from "@/lib/yandexMarket";
import { prisma } from "@/lib/prisma";

// Редирект по поисковому запросу идеи подарка на Яндекс Маркет.
// Оборачивает ссылку в партнёрскую (реферальную) через API партнёрской
// сети, если она настроена (YANDEX_MARKET_OAUTH_TOKEN + YANDEX_MARKET_CLID
// в .env) — иначе ведёт на обычный поиск на Маркете без трекинга.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q");

  if (!query) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const toNumber = (value: string | null) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };

  // Ноль — валидное значение фильтра доставки («сегодня»), поэтому разбираем
  // его отдельно от границ цены, где ноль смысла не имеет.
  const rawDelivery = params.get("d");
  const deliveryInterval =
    rawDelivery !== null && /^\d+$/.test(rawDelivery)
      ? Number(rawDelivery)
      : undefined;

  const searchUrl = buildYandexMarketSearchUrl(query, {
    from: toNumber(params.get("from")),
    to: toNumber(params.get("to")),
    deliveryInterval,
  });

  // Клик по идее — главное полезное действие сервиса. На сайте его считала
  // Метрика, но в боте нашего кода нет вовсе, поэтому считаем здесь: это
  // единственная точка, через которую проходят все источники сразу.
  const source = params.get("src") ?? "site";
  void prisma.linkClick
    .create({ data: { source: source.slice(0, 20), query: query.slice(0, 200) } })
    .catch(() => {
      // Не считать клик неприятно, но не повод задерживать человека.
    });

  const affiliateUrl = await createYandexMarketAffiliateLink(searchUrl);

  return NextResponse.redirect(affiliateUrl ?? searchUrl);
}
