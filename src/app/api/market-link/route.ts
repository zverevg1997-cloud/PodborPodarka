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
  const query = request.nextUrl.searchParams.get("q");

  if (!query) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const searchUrl = buildYandexMarketSearchUrl(query);
  const affiliateUrl = await createYandexMarketAffiliateLink(searchUrl);

  return NextResponse.redirect(affiliateUrl ?? searchUrl);
}
