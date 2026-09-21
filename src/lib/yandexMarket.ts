const API_URL =
  "https://api.content.market.yandex.ru/v3/affiliate/partner/link/create";

/**
 * Оборачивает ссылку на Яндекс Маркет в партнёрскую (трекинг) ссылку через
 * API партнёрской сети. Возвращает null, если интеграция не настроена
 * (нет токена/clid) или API вернул ошибку — в этом случае вызывающий код
 * должен использовать обычную (нетрекаемую) ссылку на Маркет как запасной
 * вариант.
 */
export async function createYandexMarketAffiliateLink(
  targetUrl: string,
): Promise<string | null> {
  const token = process.env.YANDEX_MARKET_OAUTH_TOKEN;
  const clid = process.env.YANDEX_MARKET_CLID;

  if (!token || !clid) {
    return null;
  }

  const apiUrl = new URL(API_URL);
  apiUrl.searchParams.set("url", targetUrl);
  apiUrl.searchParams.set("clid", clid);
  apiUrl.searchParams.set("format", "json");

  try {
    const res = await fetch(apiUrl, {
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.status !== "OK" || !data.link?.url) {
      return null;
    }

    return data.link.url as string;
  } catch {
    return null;
  }
}

/**
 * Строит ссылку на страницу поиска Яндекс Маркета по текстовому запросу.
 */
export function buildYandexMarketSearchUrl(query: string): string {
  const url = new URL("https://market.yandex.ru/search");
  url.searchParams.set("text", query);
  return url.toString();
}
