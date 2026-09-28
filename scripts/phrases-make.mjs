// Кандидаты в фразы для поиска по каталогу.
//
// Читает файлы подборок, берёт идеи, у которых productQuery ещё нет, и
// складывает по первым двум значимым словам поисковой фразы для Маркета.
// Она начинается почти всегда с самого предмета, а дальше идут подробности,
// которых в названии товара может и не быть.
//
// Это только кандидаты. Годятся они или нет, видно лишь по тому, что они
// находят, — для этого следом идёт match-check.mjs.
//
// Пишет: scripts/phrases.json
//
// Запуск: node scripts/phrases-make.mjs

import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "C:/Users/Master/PodborPodarka/src/content/guides";

const STOP = new Set([
  "для", "или", "под", "над", "без", "при", "про", "изо", "обо",
  "как", "что", "это", "его",
]);

const IDEA = new RegExp(
  'name:\\s*"([^"]*)",\\s*\\n' +
    "\\s*reason:[\\s\\S]*?" +
    "priceFrom:\\s*(\\d+),\\s*\\n" +
    "\\s*priceTo:\\s*(\\d+),\\s*\\n" +
    '\\s*searchQuery:\\s*"([^"]*)",' +
    '(?:\\s*\\n\\s*productQuery:\\s*"([^"]*)",)?',
  "g",
);

const out = [];
let total = 0;
let withQuery = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
  const src = readFileSync(`${DIR}/${file}`, "utf8");
  const slug = file.replace(/\.ts$/, "");

  for (const m of src.matchAll(IDEA)) {
    total++;
    const [, name, from, to, searchQuery, productQuery] = m;
    if (productQuery) {
      withQuery++;
      continue;
    }

    const words = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w));

    const query = words.length >= 2 ? words.slice(0, 2).join(" ") : words[0];
    if (!query) continue;

    out.push({ slug, idea: name, query, priceFrom: Number(from), priceTo: Number(to) });
  }
}

writeFileSync(
  "C:/Users/Master/PodborPodarka/scripts/phrases.json",
  JSON.stringify(out, null, 1),
  "utf8",
);

console.log(`идей всего: ${total}, с фразой: ${withQuery}, кандидатов: ${out.length}`);
