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

/**
 * Товары каждого поста, в том порядке, в каком они в нём названы.
 *
 * Клипы (ключи с «clip-» в начале) сюда же: та же задача — снимки и цена,
 * только идут не в пост, а в clips/make.mjs. Для них нет needsPhoto и нет
 * текста поста — просто папка со снимками, которую разбирают руками при
 * сборке ролика.
 */
const POSTS = {
  "2026-09-30-rumbox": ["5438546", "5438559", "5438547", "5438561"],
  "2026-10-01-boardgames": ["3051477", "3051438", "3051437", "3051481"],
  "2026-10-02-geyser": ["3017939", "5495651"],
  "2026-10-03-thermos": ["39038910299", "40279910299"],
  "2026-10-04-castiron": ["5663800", "3019054"],
  "2026-10-10-candles": ["3305462", "5515723", "5337736"],
  "2026-10-12-jewelry": ["5609241", "1402665", "3307694"],
  "2026-10-13-desk": ["5744272", "2974298", "2974284"],
  "2026-10-15-pets": ["3186354", "5757662", "3185094"],
  "clip-nahodki-500": ["3320207", "3320820", "5585626", "2920504", "3185094"],
  "clip-nahodki-wide": ["5337736", "5671211", "2974020", "16572", "5609254"],
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
    // Нужен для клипов: clips/make.mjs сам скачивает фон по этой ссылке,
    // не из уже скачанного файла. Обзорам она не нужна, но лишней не мешает.
    lines.push(`   фото: ${product.picture}`);
    lines.push("");

    const ext = product.picture.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1] ?? "jpg";
    const file = `${dir}/${n}.${ext.toLowerCase()}`;

    // У части адресов Озона в пути стоит размер — «/c200/». Такой снимок
    // приходит на 150×200 пикселей, и в посте это заметно: рядом с обычными
    // он выглядит мыльным пятном. Сначала пробуем без этого сегмента, то
    // есть оригинал, и только если его там нет — берём что дают.
    const sources = [product.picture.replace(/\/c\d+\//, "/"), product.picture].filter(
      (url, i, all) => all.indexOf(url) === i,
    );

    let saved = false;

    for (const source of sources) {
      try {
        const res = await fetch(source, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`магазин ответил ${res.status}`);

        const bytes = Buffer.from(await res.arrayBuffer());
        writeFileSync(file, bytes);
        console.log(`  ${n}. ${Math.round(bytes.length / 1024)} КБ  ${product.name.slice(0, 55)}`);
        saved = true;
        break;
      } catch (error) {
        if (source === sources.at(-1)) {
          console.log(`  ${n}. не скачалось (${String(error.message).slice(0, 40)}) — ${source}`);
        }
      }
    }

    if (!saved) lines.push(`   СНИМОК НЕ СКАЧАЛСЯ: ${product.picture}`);
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
