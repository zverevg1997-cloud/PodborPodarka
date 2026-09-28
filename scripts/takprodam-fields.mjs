// Какие поля у товара на самом деле.
//
// Разведка печатала поля по списку, и `product_sku` в нём не напечатался —
// значит, его нет. Идентификатор товара нам обязателен: по нему товар
// узнаётся при следующей загрузке, иначе каждое обновление заводило бы
// восемьдесят тысяч дублей.
//
// Поэтому здесь ничего не угадываем, а печатаем всё, что пришло, как есть.
//
// Запрос ровно один: на четырёх подряд нас уже отрезали по 429.
//
// Запуск: node scripts/takprodam-fields.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

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

const res = await fetch(
  "https://api.takprodam.ru/v2/publisher/product/?source_id=23312&limit=2",
  {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  },
);

console.log(`ответ: ${res.status}\n`);

// Заголовки про ограничение частоты: по ним видно, сколько запросов нам
// оставлено и через сколько ждать. Это решает, с какими паузами грузить.
console.log("=== заголовки ===\n");
for (const [name, value] of res.headers) {
  if (/limit|retry|remain|reset|quota|throttle/i.test(name)) {
    console.log(`  ${name}: ${value}`);
  }
}

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.log(`\nответ не разобрался: ${text.slice(0, 300)}`);
  process.exit(1);
}

console.log("\n=== обёртка ответа ===\n");
for (const [key, value] of Object.entries(data)) {
  if (!Array.isArray(value) && typeof value !== "object") {
    console.log(`  ${key}: ${value}`);
  } else {
    console.log(`  ${key}: ${Array.isArray(value) ? `список из ${value.length}` : "объект"}`);
  }
}

const list = Array.isArray(data)
  ? data
  : (data.items ?? data.data ?? data.results ?? data.products ?? []);

console.log(`\n=== все поля первого товара (${list.length} в ответе) ===\n`);

if (list.length === 0) {
  console.log("  товаров в ответе нет");
  process.exit(0);
}

for (const [key, value] of Object.entries(list[0])) {
  const shown =
    value === null
      ? "null"
      : typeof value === "object"
        ? JSON.stringify(value).slice(0, 120)
        : String(value).slice(0, 120);
  console.log(`  ${key.padEnd(24)} ${shown}`);
}
