/**
 * Каталог Такпродам.
 *
 * Это не выгрузка, а постраничный API: товары маркетплейсов — Wildberries,
 * Ozon, Avito, Aliexpress — с фотографией, ценой, партнёрской ссылкой и уже
 * готовым текстом маркировки рекламы.
 *
 * Зачем он нужен помимо Адмитада: наши пять магазинов — это техника, детская
 * одежда, бытовые приборы и спорт. Ни игрушек, ни настольных игр, ни книг там
 * нет, а подборок именно под них написано больше всего, и показывать в них
 * нечего.
 *
 * Товары кладём в ту же таблицу, что и выгрузки, — подбор, карточки и поиск
 * по сайту работают с ними одинаково и знать про источник не обязаны.
 *
 * Адрес выгрузки в базе выглядит как `takprodam:?marketplace=Wildberries`:
 * после двоеточия — обычная строка параметров, которую мы передаём в API.
 * Так один и тот же список выгрузок держит и файлы, и этот каталог, и
 * добавляется он теми же командами бота.
 */

import { prisma } from "@/lib/prisma";
import type { FeedProduct } from "@/lib/products/feed";

const BASE = "https://api.takprodam.ru/v2/publisher";

/** Их предел на страницу. */
const PAGE = 1000;

/**
 * Предохранитель от бесконечного обхода.
 *
 * Если API вдруг начнёт отдавать одну и ту же страницу при любом `page`,
 * цикл «пока страница полная» не кончится никогда. Триста тысяч товаров нам
 * и не нужны — столько мы всё равно не покажем.
 */
const MAX_PAGES = 300;

/** Товар в их ответе. Имена полей — из описания API, не угаданные. */
interface TakprodamProduct {
  product_id?: string | number;
  product_sku?: string | number;
  title?: string;
  price?: string | number;
  image_url?: string;
  external_link?: string;
  tracking_link?: string;
  legal_text?: string;
  product_category?: string;
  marketplace_title?: string;
  store_title?: string;
}

/** Площадка паблишера: без её идентификатора товары не отдают. */
interface TakprodamSource {
  id?: string | number;
  source_id?: string | number;
  status?: string;
  title?: string;
  source_url?: string;
}

/**
 * Список в ответе лежит то на верхнем уровне, то внутри обёртки.
 *
 * Разные методы их API отвечают по-разному, и подстроиться дешевле, чем
 * ошибиться: пустой список тут неотличим от неверно угаданного имени поля.
 */
function rows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];

  const box = data as Record<string, unknown>;
  for (const key of ["items", "data", "results", "products", "hydra:member"]) {
    if (Array.isArray(box[key])) return box[key] as T[];
  }
  return [];
}

async function api(
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const key = process.env.TAKPRODAM_API_KEY;
  if (!key) throw new Error("не задан TAKPRODAM_API_KEY");

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${query ? `?${query}` : ""}`, {
    headers: { "X-Api-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();

  if (!res.ok) {
    // 401 и 403 у них означают разное: первое — ключ не тот, второе — ключ
    // верный, но площадка ещё не подтверждена. Разница важная, поэтому
    // подсказываем прямо в сообщении.
    if (res.status === 401) throw new Error("ключ не принят (401)");
    if (res.status === 403) throw new Error("доступ закрыт (403): площадка ещё не подтверждена?");
    throw new Error(`Такпродам ответил ${res.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`ответ не разобрался: ${text.slice(0, 200)}`);
  }
}

/** Подтверждённая площадка. Её идентификатор нужен всем остальным методам. */
export async function findSource(): Promise<{ id: string; title: string }> {
  const list = rows<TakprodamSource>(await api("/source/"));
  if (list.length === 0) throw new Error("в кабинете нет ни одной площадки");

  const pick =
    list.find((s) => String(s.status).toLowerCase() === "approved") ?? list[0];

  const id = pick.source_id ?? pick.id;
  if (id === undefined) throw new Error("у площадки нет идентификатора");

  if (String(pick.status).toLowerCase() !== "approved") {
    throw new Error(
      `площадка «${pick.title ?? pick.source_url ?? id}» ещё не подтверждена (${pick.status})`,
    );
  }

  return { id: String(id), title: String(pick.title ?? pick.source_url ?? id) };
}

function toProduct(raw: TakprodamProduct): FeedProduct | null {
  const externalId = String(raw.product_id ?? raw.product_sku ?? "").trim();
  const name = String(raw.title ?? "").trim();
  const picture = String(raw.image_url ?? "").trim();

  // Партнёрская ссылка — смысл всей затеи: по обычной ссылке на маркетплейс
  // покупка нам не засчитается. Товары без неё пропускаем.
  const url = String(raw.tracking_link ?? "").trim();

  if (!externalId || !name || !picture || !url) return null;

  const price = Math.round(Number(raw.price));
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    externalId,
    name,
    description: null,
    // Магазин на маркетплейсе — ближайшее к марке, что они отдают.
    brand: raw.store_title ? String(raw.store_title).slice(0, 100) : null,
    price,
    oldPrice: null,
    url,
    picture,
    category: raw.product_category ? String(raw.product_category) : null,
    available: true,
  };
}

export interface TakprodamResult {
  saved: number;
  skipped: number;
}

/**
 * Обходит каталог постранично и пишет товары в базу.
 *
 * `params` — то, что стояло в адресе после `takprodam:`: маркетплейс,
 * раздел, тип оплаты. Идентификатор площадки подставляем сами, чтобы его не
 * приходилось искать руками и вписывать в адрес.
 */
export async function importTakprodam(
  feed: { id: string; url: string; include?: string | null },
  save: (products: (FeedProduct & { legal: string | null })[]) => Promise<void>,
): Promise<TakprodamResult> {
  const source = await findSource();

  const params = Object.fromEntries(
    new URLSearchParams(feed.url.replace(/^takprodam:\??/, "")),
  );

  const only = feed.include ? new RegExp(feed.include, "i") : null;

  let saved = 0;
  let skipped = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await api("/product/", {
      ...params,
      source_id: source.id,
      // subid уходит в их статистику: по нему видно, что покупка пришла с
      // сайта, а не из постов.
      subid: params.subid ?? "daribot",
      page: String(page),
      limit: String(PAGE),
    });

    const list = rows<TakprodamProduct>(data);
    if (list.length === 0) break;

    const batch: (FeedProduct & { legal: string | null })[] = [];

    for (const raw of list) {
      const product = toProduct(raw);
      if (!product) {
        skipped++;
        continue;
      }
      if (only && !only.test(product.category ?? "")) {
        skipped++;
        continue;
      }
      batch.push({ ...product, legal: raw.legal_text?.trim() || null });
    }

    if (batch.length > 0) {
      await save(batch);
      saved += batch.length;
    }

    // Неполная страница — каталог кончился.
    if (list.length < PAGE) break;
  }

  return { saved, skipped };
}

/** Разделы каталога: нужны, чтобы было из чего составлять отбор. */
export async function takprodamCategories(): Promise<{ id: string; title: string }[]> {
  const list = rows<{ id?: string | number; category_id?: string | number; title?: string }>(
    await api("/product-category/"),
  );

  return list
    .map((c) => ({
      id: String(c.category_id ?? c.id ?? ""),
      title: String(c.title ?? ""),
    }))
    .filter((c) => c.id && c.title);
}

/** Сколько товаров у нас от Такпродам — для ответа бота. */
export async function takprodamCount(feedId: string): Promise<number> {
  return prisma.product.count({ where: { feedId, available: true } });
}
