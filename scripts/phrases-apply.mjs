// Вписать проверенные фразы в файлы подборок.
//
// Фраза ставится строкой `productQuery` сразу за `searchQuery` той идеи, у
// которой совпало имя. Идея с уже заданной фразой не трогается: проверенное
// руками важнее любой вычисленной замены.
//
// Почему скриптом, а не руками: строк около двухсот в полусотне файлов, и
// на такой работе опечатка неизбежна, а заметна будет не сразу.
//
// Читает: scripts/phrases-approved.json — список {slug, idea, productQuery}
//
// Запуск: node scripts/phrases-apply.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const here = (name) => new URL(`../${name}`, import.meta.url).pathname.slice(1);

const approved = JSON.parse(readFileSync(here("scripts/phrases-approved.json"), "utf8"));

// По файлам: один файл читаем и пишем один раз.
const byFile = new Map();
for (const item of approved) {
  if (!byFile.has(item.slug)) byFile.set(item.slug, []);
  byFile.get(item.slug).push(item);
}

let added = 0;
const trouble = [];

for (const [slug, items] of byFile) {
  const file = here(`src/content/guides/${slug}.ts`);
  if (!existsSync(file)) {
    trouble.push(`нет файла: ${slug}`);
    continue;
  }

  let src = readFileSync(file, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";

  for (const item of items) {
    // Находим идею по имени, затем её строку searchQuery. Между ними лежат
    // reason и цены, поэтому ищем не подряд, а от места имени.
    const at = src.indexOf(`name: "${item.idea}"`);
    if (at === -1) {
      trouble.push(`${slug}: не нашёл идею «${item.idea}»`);
      continue;
    }

    const searchAt = src.indexOf("searchQuery:", at);
    if (searchAt === -1) {
      trouble.push(`${slug}: у «${item.idea}» нет searchQuery`);
      continue;
    }

    const lineEnd = src.indexOf("\n", searchAt);
    const after = src.slice(lineEnd, lineEnd + 200);

    if (after.includes("productQuery:")) {
      // Уже заполнено — оставляем как есть.
      continue;
    }

    // Отступ берём у самой строки searchQuery, чтобы не гадать про вложенность.
    const lineStart = src.lastIndexOf("\n", searchAt) + 1;
    const indent = src.slice(lineStart, searchAt);

    const insert = `${eol}${indent}productQuery: "${item.productQuery}",`;
    const cut = eol === "\r\n" ? lineEnd - 1 : lineEnd;

    src = src.slice(0, cut) + insert + src.slice(cut);
    added++;
  }

  writeFileSync(file, src, "utf8");
}

console.log(`Вписано фраз: ${added} из ${approved.length}`);
for (const line of trouble) console.log(`  ${line}`);
