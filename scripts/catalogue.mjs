// Поиск товаров в каталоге — чтобы писать обзоры по тому, что есть.
//
// Пост-обзор называет настоящие вещи с настоящими ценами, а значит перед
// тем как его писать, надо посмотреть, что в каталоге вообще лежит. База
// стоит у Timeweb и закрыта для зарубежных адресов, так что смотреть
// приходится отсюда, а не с сервера.
//
// Слова ищутся все сразу: «магнитная планка» найдёт товар, в названии
// которого есть и «магнитн», и «планк», в любом порядке. Это то же правило,
// по которому потом подбираются карточки на сайте.
//
// Печатает идентификатор товара — его и вписывают в post-photos.mjs, чтобы
// скачать снимки к посту.
//
// Запуск: node scripts/catalogue.mjs "лампа будильник" "пресс чеснок"
//         (с ВЫКЛЮЧЕННЫМ VPN)

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const here = (name) => new URL(`../${name}`, import.meta.url).pathname.slice(1);

const env = Object.fromEntries(
  readFileSync(here(".env"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const queries = process.argv.slice(2);

if (queries.length === 0) {
  console.log('Укажите, что искать: node scripts/catalogue.mjs "лампа будильник"');
  process.exit(1);
}

/** Сколько показываем на запрос. Больше глазами всё равно не просмотреть. */
const LIMIT = 12;

function find(words) {
  return prisma.product.findMany({
    where: {
      available: true,
      AND: words.map((word) => ({
        name: { contains: word, mode: "insensitive" },
      })),
    },
    select: { externalId: true, name: true, price: true },
    orderBy: { price: "asc" },
    take: LIMIT,
  });
}

function show(products) {
  for (const p of products) {
    console.log(`${String(p.price).padStart(6)} ₽  ${p.externalId.padEnd(13)} ${p.name.slice(0, 78)}`);
  }
}

for (const query of queries) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);

  // Сперва все слова разом: так находится именно то, что искали.
  const exact = await find(words);

  console.log(`\n=== «${query}» — найдено ${exact.length}${exact.length === LIMIT ? "+" : ""} ===\n`);

  if (exact.length > 0) {
    show(exact);
    continue;
  }

  // Пусто — значит магазин назвал вещь другими словами, а не значит, что её
  // нет. «Магнитная планка для ножей» лежит там как «магнитный держатель», и
  // строгий поиск отвечает на неё пустотой, из-за чего мы уже один раз
  // решили, что товара в каталоге нет. Поэтому пробуем слова по одному.
  console.log("  всех слов разом нет — смотрю по каждому слову отдельно\n");

  for (const word of words) {
    const loose = await find([word]);
    console.log(`  — «${word}»: ${loose.length === 0 ? "ничего" : ""}`);
    show(loose.slice(0, 6));
    console.log("");
  }
}

console.log("");
await prisma.$disconnect();
