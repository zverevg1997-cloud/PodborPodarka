/**
 * Разбор товарных выгрузок партнёрских магазинов.
 *
 * Формат — YML, каталог Яндекса: у всех магазинов Адмитада он одинаковый,
 * поэтому разборщик пишется один раз, а новый магазин добавляется адресом.
 *
 * Разбираем сами, без библиотеки. Причина не в экономии: файл сгенерирован
 * машиной, устроен плоско — список товаров, у каждого набор простых полей —
 * и полноценный разборщик здесь только добавил бы зависимость и память под
 * дерево на десять тысяч узлов. Если формат когда-нибудь усложнится, это
 * место придётся переписать, и вот тогда библиотека будет оправдана.
 */

export interface FeedProduct {
  externalId: string;
  name: string;
  description: string | null;
  brand: string | null;
  price: number;
  oldPrice: number | null;
  url: string;
  picture: string;
  category: string | null;
  available: boolean;
}

export interface ParsedFeed {
  shop: string | null;
  products: FeedProduct[];
}

/** В XML пять предопределённых замен, остальное нам не встречается. */
function decode(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1]) : null;
}

function money(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value);
  // Копейки в подборках не нужны, а целое сравнивать проще и надёжнее.
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function parseFeed(xml: string): ParsedFeed {
  // Названия категорий лежат отдельным справочником, а у товара только номер.
  const categories = new Map<string, string>();
  for (const match of xml.matchAll(
    /<category id="(\d+)"[^>]*>([^<]+)<\/category>/g,
  )) {
    categories.set(match[1], decode(match[2]));
  }

  const products: FeedProduct[] = [];

  for (const match of xml.matchAll(/<offer\s[^>]*>[\s\S]*?<\/offer>/g)) {
    const block = match[0];

    // Граница слова здесь обязательна: у товара рядом с id стоит group_id,
    // и без неё выражение доезжает до второго и берёт чужой номер.
    const externalId = block.match(/<offer\s[^>]*?\bid="([^"]+)"/)?.[1];
    const price = money(tag(block, "price"));

    // Первая из картинок — обложка товара: в выгрузках их складывают по
    // порядку, и следующие показывают его сбоку и сзади.
    const picture = block.match(/<picture>([^<]+)<\/picture>/)?.[1];

    // Название иногда лежит в name, иногда только в model — встречается и
    // то, и другое даже внутри одной выгрузки.
    const name = tag(block, "name") ?? tag(block, "model");

    const url = tag(block, "url");

    // Товар без цены, ссылки, названия или картинки для нас не существует:
    // подборка собирается ровно из этих четырёх вещей.
    if (!externalId || !name || !url || !picture || !price) continue;

    products.push({
      externalId,
      name,
      description: tag(block, "description"),
      brand: tag(block, "brand") ?? tag(block, "vendor"),
      price,
      oldPrice: money(tag(block, "oldprice")),
      url,
      picture: decode(picture),
      category: categories.get(tag(block, "categoryId") ?? "") ?? null,
      available: !/available="false"/.test(block),
    });
  }

  return { shop: tag(xml.slice(0, 4000), "name"), products };
}
