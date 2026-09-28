// Разведка API Такпродам, второй заход.
//
// Первый показал главное: база — https://api.takprodam.ru/api/v1, ключ
// передаётся заголовком X-Api-Key. С ним корень отвечает 406 «An error
// occurred», то есть ключ принят, а вот сам запрос сервер не устраивает —
// либо путь, либо заголовок Accept.
//
// Bearer в Authorization даёт 401, так что этот способ отпадает.
//
// Документацию прочитать не вышло: takprodam.ru с моей стороны отклоняет
// соединение. Поэтому перебираем пути и варианты Accept.
//
// Запуск: node scripts/takprodam-check.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

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
  console.log('В .env нет TAKPRODAM_API_KEY.');
  process.exit(1);
}

const BASE = "https://api.takprodam.ru/api/v1";

const PATHS = [
  "", "/products", "/product", "/goods", "/offers", "/offer",
  "/feeds", "/feed", "/export", "/catalog", "/items",
  "/advertisers", "/campaigns", "/programs", "/shops",
  "/links", "/link", "/deeplink",
  "/websites", "/sites", "/me", "/profile", "/user", "/account",
  "/statistics", "/stat", "/balance", "/reports",
];

// 406 часто означает, что серверу не нравится Accept, а не путь.
const ACCEPTS = [
  "application/json",
  "application/vnd.api+json",
  "*/*",
];

const interesting = [];

for (const path of PATHS) {
  for (const accept of ACCEPTS) {
    try {
      const res = await fetch(BASE + path, {
        headers: { "X-Api-Key": KEY, Accept: accept },
        signal: AbortSignal.timeout(12_000),
      });

      const body = (await res.text()).slice(0, 220).replace(/\s+/g, " ");

      // 404 и 406 в корне нам уже известны и ничего не добавляют.
      if (res.status === 404) continue;
      if (res.status === 406 && path !== "") continue;

      interesting.push(`${res.status}  ${accept.padEnd(24)} ${BASE}${path}\n      ${body}`);

      // Как только путь ответил осмысленно, остальные Accept не нужны.
      if (res.status < 400) break;
    } catch {
      // недоступный адрес — не новость
    }
  }
}

if (interesting.length === 0) {
  console.log("Ничего не ответило. Откройте https://takprodam.ru/api в браузере");
  console.log("и пришлите, что там написано про методы.");
} else {
  for (const line of interesting) console.log(line);
}
