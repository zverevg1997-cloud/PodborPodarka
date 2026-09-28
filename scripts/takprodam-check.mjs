// Разведка API Такпродам.
//
// Документации у нас нет, а сайт с моей стороны не открывается — российские
// адреса через этот выход в сеть недоступны. Поэтому скрипт перебирает
// правдоподобные адреса и способы передать ключ и показывает, что отвечает.
//
// Ключ берётся из .env, чтобы не мелькать в командной строке: её содержимое
// оседает в истории оболочки и видно в списке процессов.
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
  console.log('В .env нет TAKPRODAM_API_KEY. Добавьте строкой: TAKPRODAM_API_KEY="..."');
  process.exit(1);
}

const BASES = [
  "https://api.takprodam.ru",
  "https://takprodam.ru/api",
  "https://takprodam.ru/api/v1",
  "https://api.takprodam.ru/v1",
  "https://api.takprodam.ru/api/v1",
];

const PATHS = ["", "/", "/products", "/offers", "/feeds", "/campaigns", "/me", "/user"];

// Ключ могут ждать по-разному: в заголовке, в другом заголовке или в адресе.
const WAYS = [
  ["Bearer в Authorization", (u) => [u, { Authorization: `Bearer ${KEY}` }]],
  ["X-Api-Key", (u) => [u, { "X-Api-Key": KEY }]],
  ["в адресе", (u) => [`${u}${u.includes("?") ? "&" : "?"}api_key=${KEY}`, {}]],
];

const seen = new Set();

for (const base of BASES) {
  for (const path of PATHS) {
    const url = base + path;
    if (seen.has(url)) continue;
    seen.add(url);

    for (const [label, build] of WAYS) {
      const [target, headers] = build(url);
      try {
        const res = await fetch(target, {
          headers: { Accept: "application/json", ...headers },
          signal: AbortSignal.timeout(12_000),
        });

        // Интересны только осмысленные ответы: 404 и отказы соединения
        // ничего не говорят, а вот 200, 401 и 403 говорят многое.
        if (res.status === 404) continue;

        const body = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
        console.log(`${res.status}  ${label.padEnd(22)} ${url}`);
        if (body) console.log(`      ${body}`);
      } catch {
        // молчим: недоступный адрес — это не новость
      }
    }
  }
}

console.log("\nЕсли всё молчит — пришлите ссылку на документацию из кабинета.");
