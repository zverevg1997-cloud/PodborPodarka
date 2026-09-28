// Что лежит в каталоге Такпродам.
//
// Их API отдаёт товары маркетплейсов — Ozon, Wildberries, Avito,
// Aliexpress — с фотографией, ценой, партнёрской ссылкой и уже готовой
// маркировкой рекламы. Это ровно то, чего не хватало: в наших пяти
// магазинах Адмитада нет ни игрушек, ни настольных игр, ни книг.
//
// Перед тем как писать загрузчик, смотрим на настоящие данные: сколько
// товаров, какие категории, как выглядит запись.
//
// Запуск: node scripts/takprodam-explore.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url).pathname.slice(1), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const KEY = env.TAKPRODAM_API_KEY;
if (!KEY) {
  console.log("В .env нет TAKPRODAM_API_KEY.");
  process.exit(1);
}

const BASE = "https://api.takprodam.ru/v2/publisher";

async function get(path, params = {}) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} → ответ не разобрался: ${text.slice(0, 200)}`);
  }
}

/** Ответ бывает и списком, и объектом со списком внутри. */
const rows = (data) =>
  Array.isArray(data) ? data : (data.items ?? data.data ?? data.results ?? data["hydra:member"] ?? []);

console.log("=== площадки ===\n");
const sources = rows(await get("/source/"));
for (const s of sources) {
  console.log(`  id ${s.id} · ${s.status} · ${s.title ?? ""} · ${s.source_url ?? ""}`);
}

const approved = sources.find((s) => s.status === "approved") ?? sources[0];
if (!approved) {
  console.log("\nПодтверждённых площадок нет — товары не отдадут.");
  process.exit(0);
}

console.log(`\nберу площадку ${approved.id}\n`);

console.log("=== категории ===\n");
const categories = rows(await get("/product-category/"));
console.log(`всего: ${categories.length}\n`);
for (const c of categories.slice(0, 40)) {
  console.log(`  ${String(c.id).padStart(5)}  ${c.title}`);
}

console.log("\n=== товары, первая страница ===\n");
const first = await get("/product/", { source_id: approved.id, limit: "5" });
const products = rows(first);

// Служебные поля ответа тоже интересны: по ним видно, сколько всего товаров
// и как листать дальше.
const meta = Object.entries(first).filter(([, v]) => typeof v !== "object");
if (meta.length) console.log("служебные поля:", JSON.stringify(Object.fromEntries(meta)), "\n");

for (const p of products.slice(0, 3)) {
  console.log("—", p.title?.slice(0, 70));
  for (const key of [
    "price", "commission", "marketplace_title", "store_title",
    "product_category", "product_sku", "image_url", "legal_text",
  ]) {
    if (p[key] !== undefined) console.log(`   ${key}: ${String(p[key]).slice(0, 90)}`);
  }
  console.log(`   tracking_link: ${String(p.tracking_link ?? "").slice(0, 70)}…\n`);
}

// Сколько товаров вообще — по каждому маркетплейсу отдельно.
console.log("=== сколько товаров по маркетплейсам ===\n");
for (const market of ["Wildberries", "Ozon", "Avito", "Aliexpress"]) {
  try {
    const page = await get("/product/", { source_id: approved.id, marketplace: market, limit: "1" });
    const list = rows(page);
    const total = page.total ?? page.count ?? page["hydra:totalItems"] ?? "?";
    console.log(`  ${market.padEnd(12)} всего: ${total}${list.length === 0 ? " (пусто)" : ""}`);
  } catch (error) {
    console.log(`  ${market.padEnd(12)} ${String(error.message).slice(0, 80)}`);
  }
}
