// Как Такпродам хочет получать ключ.
//
// На /api/v1 заголовок X-Api-Key принимался: с ним приходило 406 («не тот
// формат»), а с Bearer — 401. То есть ключ узнавали. На /v2/publisher/ тот же
// заголовок даёт 401, значит способ передачи там другой.
//
// Перебираем способы и адреса и печатаем только коды ответов. Сам ключ никуда
// не выводим — ни целиком, ни куском.
//
// Запуск: node scripts/takprodam-auth.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

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

console.log(`ключ: ${KEY.length} символов\n`);

/**
 * Способы назвать ключ. Значение везде одно и то же.
 *
 * Первая строка — опора: запрос вообще без ключа. Если она отвечает тем же
 * 401, что и все остальные, значит ключ не узнают ни в каком виде, и дело не
 * в заголовке, а в самом ключе. Если чем-то другим — заголовок мы угадали, но
 * не тот.
 */
const WAYS = [
  ["без ключа", {}],
  ["X-Api-Key", { "X-Api-Key": KEY }],
  ["Api-Key", { "Api-Key": KEY }],
  ["X-Api-Token", { "X-Api-Token": KEY }],
  ["X-Auth-Token", { "X-Auth-Token": KEY }],
  ["X-Token", { "X-Token": KEY }],
  ["Authorization: Bearer", { Authorization: `Bearer ${KEY}` }],
  ["Authorization: голый", { Authorization: KEY }],
  ["Authorization: Token", { Authorization: `Token ${KEY}` }],
  ["в адресе api_key", null],
  ["в адресе token", null],
];

const PATHS = [
  "https://api.takprodam.ru/v2/publisher/source/",
  "https://api.takprodam.ru/v2/publisher/source",
  "https://api.takprodam.ru/api/v1/publisher/source/",
];

for (const path of PATHS) {
  console.log(`=== ${path} ===\n`);

  for (const [label, headers] of WAYS) {
    // Два последних способа кладут ключ не в заголовок, а в адрес.
    const param = label.startsWith("в адресе") ? label.split(" ").pop() : null;
    const url = param ? `${path}?${param}=${encodeURIComponent(KEY)}` : path;

    try {
      const res = await fetch(url, {
        headers: { ...(headers ?? {}), Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });

      const text = await res.text();

      // 200 — разбираем, что пришло: список площадок или что-то другое.
      let hint = text.slice(0, 120).replace(/\s+/g, " ");
      if (res.ok) {
        try {
          const data = JSON.parse(text);
          const list = Array.isArray(data)
            ? data
            : (data.items ?? data.data ?? data.results ?? []);
          hint = Array.isArray(list) ? `записей: ${list.length}` : "не список";
        } catch {
          /* оставляем начало ответа как есть */
        }
      }

      console.log(`  ${String(res.status).padEnd(4)} ${label.padEnd(22)} ${hint}`);
    } catch (error) {
      console.log(`  ---  ${label.padEnd(22)} ${String(error.message).slice(0, 60)}`);
    }
  }

  console.log("");
}
