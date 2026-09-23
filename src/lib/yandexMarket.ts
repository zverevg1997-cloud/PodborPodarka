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
 *
 * Границы цены передаём параметрами pricefrom и priceto — строго строчными:
 * с заглавными буквами (priceTo) Маркет их молча игнорирует, выдача приходит
 * без фильтра, и заметить это можно только глазами.
 */
export function buildYandexMarketSearchUrl(
  query: string,
  options?: { from?: number; to?: number; deliveryInterval?: number },
): string {
  const url = new URL("https://market.yandex.ru/search");
  url.searchParams.set("text", query);

  if (options?.from) url.searchParams.set("pricefrom", String(options.from));
  if (options?.to) url.searchParams.set("priceto", String(options.to));

  // 0 — сегодня, 1 — сегодня-завтра, 3 — до трёх дней. Ноль здесь значимый,
  // поэтому проверяем на undefined, а не на истинность.
  if (options?.deliveryInterval !== undefined) {
    url.searchParams.set("delivery-interval", String(options.deliveryInterval));
  }

  return url.toString();
}

/**
 * Строит ссылку на обычный поиск Яндекса. Используется для услуг,
 * сертификатов и цветов: их ищут по городу, а не на маркетплейсе.
 */
export function buildYandexSearchUrl(query: string, city?: string | null): string {
  const url = new URL("https://yandex.ru/search/");
  url.searchParams.set("text", city ? `${query} ${city}` : query);
  return url.toString();
}

/**
 * Ссылка на поиск по картам — магазины города с адресами и часами работы.
 *
 * Нужна, когда подарок нужен сегодня: доставка с маркетплейса не успеет, а
 * человеку важно понять, куда можно съездить прямо сейчас. Обычный поиск на
 * такой запрос отвечает интернет-магазинами, то есть снова доставкой.
 */
export function buildYandexMapsUrl(query: string, city: string): string {
  const url = new URL("https://yandex.ru/maps/");
  url.searchParams.set("text", `${query} купить ${city}`);
  return url.toString();
}
