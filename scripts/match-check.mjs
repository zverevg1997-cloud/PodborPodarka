// Что находит каждая фраза.
//
// Фразы для подборок пишутся руками и проверяются глазами — иначе под
// «настольной игрой» оказывается настольная лампа. Проверять глазами можно
// только то, что видно, поэтому здесь фраза прогоняется по базе и рядом
// печатаются названия найденных товаров.
//
// Отбор повторяет lib/products/match слово в слово. Если тот изменится, надо
// менять и здесь: разойдутся — и проверка начнёт врать.
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

const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
});

// --- отбор, как в lib/products/match ---

const GENERIC = new Set([
  "подарочн", "сертификат", "набор", "детск", "хорош", "больш",
  "нов", "красив", "удобн", "прост", "качествен", "лучш", "подарок",
]);

const stem = (word) =>
  word.replace(
    /(ами|ями|ов|ей|ам|ям|ах|ях|ой|ую|ые|ый|ий|ая|ое|ым|им|ом|ем|ы|и|а|я|у|ю|е)$/u,
    "",
  );

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^а-яёa-z\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .map(stem);

async function find(query, priceFrom, priceTo) {
  const needed = words(query);
  if (needed.length === 0) return { reason: "пустой запрос", products: [] };

  if (needed.every((word) => [...GENERIC].some((g) => word.startsWith(g)))) {
    return { reason: "одни служебные слова", products: [] };
  }

  const candidates = await prisma.product.findMany({
    where: {
      available: true,
      price: { gte: priceFrom, lte: priceTo },
      name: { contains: needed[0], mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 1000,
  });

  const seen = new Set();
  const products = [];

  for (const product of candidates) {
    const name = words(product.name).join(" ");
    if (!needed.every((word) => name.includes(word))) continue;

    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    products.push(product);
    if (products.length === 3) break;
  }

  return { reason: candidates.length === 0 ? "в вилке нет ничего" : "", products };
}

// --- прогон ---

const phrases = JSON.parse(readFileSync(here("scripts/phrases.json"), "utf8"));
const lines = [];

let hit = 0;

for (const item of phrases) {
  const { products, reason } = await find(item.query, item.priceFrom, item.priceTo);

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

const head = `Проверено фраз: ${phrases.length}, нашли товар: ${hit}\n\n`;
writeFileSync(here("scripts/phrases-result.txt"), head + lines.join("\n"), "utf8");

console.log(head.trim());
console.log("Подробности: scripts/phrases-result.txt");

await prisma.$disconnect();
