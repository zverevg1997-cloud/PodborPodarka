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

import type { FeedProduct } from "@/lib/products/feed";

const BASE = "https://api.takprodam.ru/v2/publisher";

/** Их предел на страницу. */
const PAGE = 1000;

/**
 * Предохранитель от бесконечного обхода.
 *
 * Если API вдруг начнёт отдавать одну и ту же страницу при любом `page`,
 * цикл «пока страница полная» не кончится никогда.
 *
 * Берём каталог целиком, поэтому предел высокий — полмиллиона товаров. Он
 * тут не для экономии, а чтобы обход не стал вечным: когда упираемся в него,
 * говорим об этом вслух, иначе недобранный хвост будет молча пропадать при
 * каждом обновлении.
 */
const MAX_PAGES = 500;

/** Товар в их ответе. Имена полей — из живого ответа, не из описания. */
interface TakprodamProduct {
  /** Их номер товара. Берём его за свой: один на весь каталог и не меняется. */
  product_id?: string | number;
  /** Идентификатор записи в их базе, на случай если номера не окажется. */
  id?: string;
  /**
   * Номер товара на самом маркетплейсе — он же в конце external_link.
   * За свой не берём: у Озона и Wildberries номера могут совпасть, а каталог
   * мы храним общий, и два разных товара слились бы в один.
   */
  sku?: string | number;
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

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Пауза между запросами.
 *
 * Не перестраховка: на четырёх быстрых запросах подряд нас отрезали по 429.
 * Каталог — восемьдесят страниц, так что секунда на страницу стоит нам
 * полторы минуты и снимает вопрос целиком.
 */
const PAUSE_MS = 1000;

/** Сколько раз пробуем снова, когда просят подождать. */
const RETRIES = 5;

async function api(
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const key = process.env.TAKPRODAM_API_KEY;
  if (!key) throw new Error("не задан TAKPRODAM_API_KEY");

  const query = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${query ? `?${query}` : ""}`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      // Именно Bearer. На старом /api/v1 было наоборот — там ключ узнавали по
      // заголовку X-Api-Key, а Bearer отвергали, — и это сбивает с толку.
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });

    // Просят подождать — ждём. Сколько именно, они иногда говорят сами;
    // если молчат, отступаем всё дальше: 5, 10, 20, 40, 60 секунд.
    if (res.status === 429 && attempt < RETRIES) {
      const told = Number(res.headers.get("retry-after"));
      const backoff = Math.min(5000 * 2 ** attempt, 60_000);
      await wait(Number.isFinite(told) && told > 0 ? told * 1000 : backoff);
      continue;
    }

    const text = await res.text();

    if (!res.ok) {
      // Коды у них означают разное, и разница стоит отдельных слов:
      // 401 — ключ не тот (или не Bearer), 403 — ключ верный, но площадка
      // не подтверждена, 429 — мы слишком частим.
      if (res.status === 401) throw new Error("ключ не принят (401)");
      if (res.status === 403) throw new Error("доступ закрыт (403): площадка ещё не подтверждена?");
      if (res.status === 429) throw new Error("Такпродам держит нас на паузе (429) — попробуйте позже");
      throw new Error(`Такпродам ответил ${res.status}: ${text.slice(0, 200)}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`ответ не разобрался: ${text.slice(0, 200)}`);
    }
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
  const externalId = String(raw.product_id ?? raw.id ?? "").trim();
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
  /** Обход упёрся в предел, и часть каталога осталась незабранной. */
  capped: boolean;
}

/**
 * Какие разделы обходить.
 *
 * Отсеивать ненужное по названию нельзя: у товара в `product_category` стоит
 * подраздел — «Отделочные и строительные материалы», — а в справочнике
 * двадцать один раздел верхнего уровня, и пересечения между ними нет.
 * Поэтому пользуемся их отбором: обходим каталог по разделам, а ненужные
 * просто не запрашиваем.
 *
 * Список исключённых храним как есть и раскрываем при каждой загрузке, а не
 * один раз при подключении. Иначе раздел, заведённый ими позже, к нам бы
 * никогда не попал — и заметили бы мы это нескоро.
 */
async function passes(params: Record<string, string>): Promise<(string | null)[]> {
  if (params.category_id) return params.category_id.split(",").map((s) => s.trim());

  if (params.not_category_id) {
    const drop = new Set(params.not_category_id.split(",").map((s) => s.trim()));
    const all = await takprodamCategories();
    const keep = all.map((c) => c.id).filter((id) => !drop.has(id));

    // Пустой список означал бы «обойти всё», то есть ровно наоборот. Лучше
    // сказать вслух, чем молча принести весь каталог.
    if (keep.length === 0) throw new Error("исключены все разделы — грузить нечего");
    return keep;
  }

  // Ни включений, ни исключений — один проход по всему каталогу.
  return [null];
}

/**
 * Обходит каталог постранично и пишет товары в базу.
 *
 * `params` — то, что стояло в адресе после `takprodam:`: маркетплейс,
 * разделы, тип оплаты. Идентификатор площадки подставляем сами, чтобы его не
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

  // Наши собственные параметры в запрос не уходят: разделы к этому моменту
  // уже раскрыты и подставляются поштучно, а чужой параметр их API либо не
  // поймёт, либо поймёт не так.
  const query = { ...params };
  delete query.category_id;
  delete query.not_category_id;

  const only = feed.include ? new RegExp(feed.include, "i") : null;

  let saved = 0;
  let skipped = 0;
  let capped = false;
  let first = true;

  for (const categoryId of await passes(params)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      // Пауза перед каждым запросом, кроме самого первого: восемьдесят
      // страниц подряд без неё — гарантированный 429.
      if (!first) await wait(PAUSE_MS);
      first = false;

      const data = await api("/product/", {
        ...query,
        source_id: source.id,
        ...(categoryId ? { category_id: categoryId } : {}),
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

      // Неполная страница — раздел кончился. Дошли до предела — значит
      // кончился не он, а наше терпение, и об этом надо сказать.
      if (list.length < PAGE) break;
      if (page === MAX_PAGES) capped = true;
    }
  }

  return { saved, skipped, capped };
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

/**
 * Сколько товаров в каталоге — всего и по маркетплейсам.
 *
 * Нужно до подключения: каталог берём целиком, и полезно знать заранее,
 * десять это тысяч или триста. Общее число API сообщает в служебном поле
 * ответа, а как оно называется — у разных методов по-разному, поэтому
 * перебираем привычные имена. Не нашли — честно говорим «не сообщил», а не
 * выдаём ноль за правду.
 */
export async function takprodamTotals(
  sourceId: string,
): Promise<{ marketplace: string; total: number | null }[]> {
  const MARKETS = ["Wildberries", "Ozon", "Avito", "Aliexpress"];
  const out: { marketplace: string; total: number | null }[] = [];

  for (const marketplace of [null, ...MARKETS]) {
    // Пять запросов подряд — ровно тот случай, на котором нас отрезали.
    if (out.length > 0) await wait(PAUSE_MS);

    try {
      const data = await api("/product/", {
        source_id: sourceId,
        ...(marketplace ? { marketplace } : {}),
        limit: "1",
      });

      out.push({
        marketplace: marketplace ?? "всего",
        total: totalOf(data) ?? (rows(data).length > 0 ? null : 0),
      });
    } catch {
      out.push({ marketplace: marketplace ?? "всего", total: null });
    }
  }

  return out;
}

function totalOf(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const box = data as Record<string, unknown>;

  for (const key of ["total", "count", "total_count", "totalItems", "hydra:totalItems"]) {
    const value = box[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }

  // Бывает, что счётчик лежит внутри обёртки meta или pagination.
  for (const key of ["meta", "pagination"]) {
    const nested = box[key];
    if (nested && typeof nested === "object") {
      const found = totalOf(nested);
      if (found !== null) return found;
    }
  }

  return null;
}
