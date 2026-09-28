// Работает ли у них отбор по разделу.
//
// Вопрос не праздный. В ответе про товар лежит `product_category`, и это
// подраздел — «Отделочные и строительные материалы», — а не одно из
// двадцати одного названия из справочника. Значит, отсеять ненужное по
// названию раздела нельзя: сравнивать не с чем.
//
// Остаётся их собственный отбор, параметр `category_id`. Проверяем, что он
// вообще что-то делает, и заодно смотрим, нет ли в справочнике вложенности —
// тогда подразделы можно было бы разложить по разделам самим.
//
// Запросов три, с паузами: на четырёх подряд нас отрезали по 429.
//
// Запуск: node scripts/takprodam-categories.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

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

const SOURCE = "23312";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function get(path, params) {
  const url = `https://api.takprodam.ru/v2/publisher${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 150)}`);
  return JSON.parse(text);
}

const rows = (d) => (Array.isArray(d) ? d : (d.items ?? d.data ?? d.results ?? []));

// 1. Справочник целиком: есть ли у раздела родитель или вложенные.
console.log("=== справочник, первая запись как есть ===\n");
const cats = await get("/product-category/", {});
const list = rows(cats);
for (const [key, value] of Object.entries(list[0] ?? {})) {
  const shown =
    value === null ? "null" : typeof value === "object" ? JSON.stringify(value).slice(0, 200) : String(value);
  console.log(`  ${key.padEnd(20)} ${shown}`);
}

// 2. Сколько товаров без отбора — опора для сравнения.
await wait(1500);
console.log("\n=== без отбора ===\n");
const all = await get("/product/", { source_id: SOURCE, limit: "1" });
console.log(`  всего: ${all.total_count}`);

// 3. То же с отбором по «Книгам и канцелярии». Если число изменилось —
// отбор работает, и грузить ненужное не придётся.
await wait(1500);
console.log("\n=== только раздел 16 «Книги и канцелярия» ===\n");
try {
  const books = await get("/product/", { source_id: SOURCE, category_id: "16", limit: "3" });
  console.log(`  всего: ${books.total_count}`);

  const items = rows(books);
  console.log(`\n  подразделы внутри:`);
  for (const p of items) {
    console.log(`    ${p.product_category} — ${String(p.title).slice(0, 60)}`);
  }

  console.log(
    `\n  вывод: отбор ${books.total_count !== all.total_count ? "РАБОТАЕТ" : "НЕ работает — число то же"}`,
  );
} catch (error) {
  console.log(`  ${error.message}`);
}
