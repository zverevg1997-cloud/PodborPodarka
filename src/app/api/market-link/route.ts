import { NextRequest, NextResponse } from "next/server";
import {
  buildYandexMarketSearchUrl,
  createYandexMarketAffiliateLink,
} from "@/lib/yandexMarket";

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

  const affiliateUrl = await createYandexMarketAffiliateLink(searchUrl);

  return NextResponse.redirect(affiliateUrl ?? searchUrl);
}
