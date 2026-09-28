// Что находит каждая фраза.
//
// Фразы для подборок пишутся руками и проверяются глазами — иначе под
// «настольной игрой» оказывается настольная лампа. Проверять глазами можно
// только то, что видно, поэтому здесь фраза прогоняется по базе и рядом
// печатаются названия найденных товаров.
//
// Товары забираем один раз и сравниваем у себя. Пятьсот сорок шесть запросов
// подряд, каждый на тысячу строк, база не выдержала и закрыла соединение
// (P1017) — а нужны нам всего три поля, и весь каталог в них весит единицы
// мегабайт.
//
// Отбор повторяет lib/products/match слово в слово, включая предел в тысячу
// кандидатов: без него проверка показывала бы товары, которых сайт всё равно
// не покажет.
//
// Читает: scripts/phrases.json — список {slug, idea, query, priceFrom, priceTo}
// Пишет:  scripts/phrases-result.txt
//
// Запуск: node scripts/match-check.mjs   (с ВЫКЛЮЧЕННЫМ VPN — база у Timeweb)

import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const here = (name) => new URL(`../${name}`, import.meta.url).pathname.slice(1);

const env = Object.fromEntries(
  readFileSync(here(".env"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

// DATABASE_URL, а не DATABASE_URL_POOLER: второй остался с переезда и
// смотрит в базу, где таблицы products нет вовсе (P2021). Соединение рвалось
// не из-за него, а из-за пятисот запросов подряд — теперь их полтора десятка.
const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});

// --- отбор, как в lib/products/match ---

const GENERIC = new Set([
  "подарочн", "сертификат", "набор", "детск", "хорош", "больш",
  "нов", "красив", "удобн", "прост", "качествен", "лучш", "подарок",
]);

const stem = (word) => {
  const cut = word.replace(
    /(ами|ями|ов|ей|ам|ям|ах|ях|ой|ую|ые|ый|ий|ая|ое|ым|им|ом|ем|ы|и|а|я|у|ю|е)$/u,
    "",
  );

  // Короче трёх букв не режем: «крем» превращался в «кр», а «кр» есть в
  // «круглый». Совпадает с lib/products/match.
  return cut.length >= 3 ? cut : word;
};

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^а-яёa-z\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .map(stem);

// --- забираем каталог ---

const CHUNK = 5000;
const all = [];

for (let skip = 0; ; skip += CHUNK) {
  const page = await prisma.product.findMany({
    where: { available: true },
    select: { name: true, price: true },
    orderBy: { price: "asc" },
    skip,
    take: CHUNK,
  });

  all.push(...page);
  process.stdout.write(`\rзагружено товаров: ${all.length}`);
  if (page.length < CHUNK) break;
}

await prisma.$disconnect();
console.log("");

// Один раз разбираем названия на основы: иначе каждая из пятисот фраз
// перемалывала бы весь каталог заново.
const catalogue = all.map((p) => ({
  name: p.name,
  price: p.price,
  stems: words(p.name).join(" "),
}));

// --- прогон ---

function find(query, priceFrom, priceTo) {
  const needed = words(query);
  if (needed.length === 0) return { reason: "пустой запрос", products: [] };

  if (needed.every((word) => [...GENERIC].some((g) => word.startsWith(g)))) {
    return { reason: "одни служебные слова", products: [] };
  }

  const candidates = catalogue
    .filter(
      (p) =>
        p.price >= priceFrom &&
        p.price <= priceTo &&
        p.name.toLowerCase().includes(needed[0]),
    )
    .slice(0, 1000);

  const seen = new Set();
  const products = [];

  for (const product of candidates) {
    if (!needed.every((word) => product.stems.includes(word))) continue;

    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    products.push(product);
    if (products.length === 3) break;
  }

  return { reason: candidates.length === 0 ? "в вилке нет ничего" : "", products };
}

const phrases = JSON.parse(readFileSync(here("scripts/phrases.json"), "utf8"));
const lines = [];

let hit = 0;

for (const item of phrases) {
  const { products, reason } = find(item.query, item.priceFrom, item.priceTo);

  lines.push(`${item.slug} · ${item.idea}`);
  lines.push(`  «${item.query}»  ${item.priceFrom}–${item.priceTo} ₽`);

  if (products.length === 0) {
    lines.push(`  — пусто${reason ? ` (${reason})` : ""}`);
  } else {
    hit++;
    for (const p of products) {
      lines.push(`  ${String(p.price).padStart(6)} ₽  ${p.name.slice(0, 90)}`);
    }
  }
  lines.push("");
}

const head =
  `Товаров в базе: ${catalogue.length}\n` +
  `Проверено фраз: ${phrases.length}, нашли товар: ${hit}\n\n`;

writeFileSync(here("scripts/phrases-result.txt"), head + lines.join("\n"), "utf8");

console.log(head.trim());
console.log("Подробности: scripts/phrases-result.txt");
