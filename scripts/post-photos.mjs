// Фотографии и ссылки к постам-обзорам.
//
// Пост-обзор называет настоящие товары, значит к нему нужны их настоящие
// снимки. Берём их из каталога по идентификатору товара, а не по названию:
// название меняется, когда магазин переписывает карточку, а номер — нет.
//
// Снимки лежат на витринах магазинов, и те закрыты для зарубежных адресов —
// с включённым VPN скачивание отваливается по тайм-ауту. Поэтому скрипт
// запускается у вас, а не на сервере.
//
// Заодно выписываем партнёрские ссылки и текст маркировки: в самом посте их
// нет, потому что ВК прячет записи с внешними ссылками, и класть их принято
// первым комментарием. А без маркировки такой комментарий публиковать нельзя.
//
// Пишет: posts/<ключ поста>/ — снимки и links.txt
//
// Запуск: node scripts/post-photos.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

/** Товары каждого поста, в том порядке, в каком они в нём названы. */
const POSTS = {
  "2026-10-06-rumbox": ["5438546", "5438559", "5438547", "5438561"],
  "2026-10-07-boardgames": ["3051477", "3051438", "3051437", "3051481"],
  "2026-10-08-geyser": ["3017939", "5495651"],
  "2026-10-09-thermos": ["39038910299", "40279910299"],
  "2026-10-10-castiron": ["5663800", "3019054"],
};

for (const [post, ids] of Object.entries(POSTS)) {
  const dir = here(`posts/${post}`);
  mkdirSync(dir, { recursive: true });

  const products = await prisma.product.findMany({
    where: { externalId: { in: ids }, available: true },
    select: { externalId: true, name: true, price: true, url: true, picture: true, legal: true },
  });

  // Порядок в базе свой, а нам нужен порядок из поста.
  const ordered = ids
    .map((id) => products.find((p) => p.externalId === id))
    .filter(Boolean);

  console.log(`\n=== ${post} — ${ordered.length} из ${ids.length} ===`);

  const lines = [];
  let n = 0;

  for (const product of ordered) {
    n++;
    lines.push(`${n}. ${product.name}`);
    lines.push(`   ${product.price} ₽`);
    lines.push(`   ${product.url}`);
    if (product.legal) lines.push(`   ${product.legal}`);
    lines.push("");

    const ext = product.picture.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1] ?? "jpg";
    const file = `${dir}/${n}.${ext.toLowerCase()}`;

    try {
      const res = await fetch(product.picture, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`магазин ответил ${res.status}`);

      const bytes = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, bytes);
      console.log(`  ${n}. ${Math.round(bytes.length / 1024)} КБ  ${product.name.slice(0, 55)}`);
    } catch (error) {
      console.log(`  ${n}. не скачалось (${String(error.message).slice(0, 40)}) — ${product.picture}`);
    }
  }

  // Товар, пропавший из выгрузки, лучше заметить сейчас, а не в день выхода.
  for (const id of ids) {
    if (!ordered.some((p) => p.externalId === id)) {
      lines.push(`ПРОПАЛ из каталога: ${id}`);
      console.log(`  — товара ${id} в каталоге больше нет`);
    }
  }

  writeFileSync(`${dir}/links.txt`, lines.join("\n"), "utf8");
}

console.log("\nГотово. Снимки и ссылки — в папке posts/");

await prisma.$disconnect();
