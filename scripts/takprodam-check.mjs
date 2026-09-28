// Разведка API Такпродам, третий заход — и, судя по всему, последний.
//
// Что выяснили: база https://api.takprodam.ru/api/v1, ключ в заголовке
// X-Api-Key, а сам интерфейс построен на API Platform — он отвечает
// JSON-LD и умеет описывать себя сам.
//
// Ключевая деталь: с Accept: application/json сервер отвечает 406, а с
// */* отдаёт Entrypoint. Значит, разговаривать с ним надо на его языке —
// application/ld+json. Тогда Entrypoint перечислит все свои коллекции, а
// по адресу /docs лежит полное описание с полями и фильтрами.
//
// Запуск: node scripts/takprodam-check.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { readFileSync, writeFileSync } from "node:fs";

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

const BASE = "https://api.takprodam.ru/api/v1";

async function get(path, accept) {
  const res = await fetch(BASE + path, {
    headers: { "X-Api-Key": KEY, Accept: accept },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, text: await res.text() };
}

// 1. Сам себя описывающий список коллекций.
console.log("=== что API умеет ===\n");

let entry;
for (const accept of ["application/ld+json", "application/hal+json", "*/*"]) {
  const { status, text } = await get("", accept);
  if (status !== 200) continue;
  try {
    const data = JSON.parse(text);
    const links = Object.entries(data).filter(
      ([k, v]) => !k.startsWith("@") && typeof v === "string",
    );
    if (links.length > 0) {
      entry = { accept, links };
      break;
    }
  } catch {
    // не JSON — идём дальше
  }
}

if (entry) {
  console.log(`через Accept: ${entry.accept}\n`);
  for (const [name, href] of entry.links) console.log(`  ${name.padEnd(28)} ${href}`);
} else {
  console.log("Entrypoint пуст — коллекции он не перечислил.\n");
}

// 2. Полное описание: у API Platform оно лежит под /docs в двух видах.
console.log("\n=== описание методов ===\n");

for (const [path, accept, label] of [
  ["/docs.jsonld", "application/ld+json", "Hydra"],
  ["/docs.json", "application/json", "OpenAPI"],
  ["/docs", "application/vnd.openapi+json", "OpenAPI"],
]) {
  try {
    const { status, text } = await get(path, accept);
    if (status !== 200) { console.log(`${status}  ${path}`); continue; }

    const file = new URL(`../takprodam-api.json`, import.meta.url).pathname.slice(1);
    writeFileSync(file, text);
    console.log(`${label} сохранено в takprodam-api.json — ${Math.round(text.length / 1024)} КБ`);

    // Сразу показываем, какие пути там описаны.
    const paths = [...text.matchAll(/"(\/api\/v1\/[a-z0-9_\-{}/]+)"/gi)]
      .map((m) => m[1])
      .filter((p, i, all) => all.indexOf(p) === i)
      .slice(0, 40);

    if (paths.length) {
      console.log("\nнайденные адреса:");
      for (const p of paths) console.log("  " + p);
    }
    break;
  } catch {
    console.log(`нет связи  ${path}`);
  }
}
