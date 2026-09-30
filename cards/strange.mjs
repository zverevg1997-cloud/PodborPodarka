// Карусель к посту «Вещи, которые человек не купит себе сам».
//
// Пост перечисляет четыре вещи, и в ленте они должны быть видны, а не
// только названы. Обложку делает cards/make.mjs вместе с остальными
// карточками, а здесь — по одной карточке на вещь: изображение, название,
// цена и одна строка о том, зачем она.
//
// Изображения свои, нарисованные (cards/art.mjs). Снимков этих товаров у
// нас нет: в каталоге их не нашлось, а карточки магазинов брать нельзя —
// это чужие рекламные креативы с чужим текстом поверх. Рисунок честнее:
// он показывает вещь, не выдавая себя за конкретный товар.
//
// Цены проверены по Ozon и Яндекс Маркету 30 сентября 2026 года и стоят как
// «от»: они разъезжаются, а нижняя граница держится.
//
// Устроено так же, как cards/carousel.mjs, но читает фон с диска, а не из
// сети. Слить их в один файл я не стал: тот ходит на boxdari.ru, проверить
// его после правки отсюда нельзя, а ломать работающее ради экономии
// тридцати строк — плохой обмен.
//
// Запуск: node cards/strange.mjs  →  cards/out/strange/

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SIZE = 1080;
const MARGIN = 72;

const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";
const GOLD = "#ffb020";

const ITEMS = [
  {
    background: "23-lampa",
    name: "Лампа-будильник\nс рассветом",
    price: "от 990 ₽",
    note: "Разгорается за полчаса до подъёма. Для того, кто встаёт в темноте с октября по март, меняет зиму целиком",
  },
  {
    background: "24-chesnok",
    name: "Пресс для чеснока\nс толкателем",
    price: "от 250 ₽",
    note: "Обычный пресс невозможно отмыть. У этого есть вторая деталь, которая выдавливает остатки наружу",
  },
  {
    background: "25-planka",
    name: "Магнитная планка\nдля ножей",
    price: "от 290 ₽",
    note: "Ножи перестают тупиться друг о друга в ящике. Вешается за полчаса",
  },
  {
    background: "26-kolba",
    name: "Колба\nдля автополива",
    price: "от 280 ₽",
    note: "Втыкается в горшок и поливает растение неделю. Тому, кто любит цветы и регулярно уезжает",
  },
];

const dir = (name) =>
  decodeURIComponent(new URL(name, import.meta.url).pathname.slice(1));

mkdirSync(dir("out/strange/"), { recursive: true });

const esc = (t) =>
  t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function wrap(text, size, maxWidth) {
  const limit = Math.floor(maxWidth / (size * 0.53));
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > limit && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const brandDefs = `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${PINK}"/><stop offset="1" stop-color="${VIOLET}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1a1225" stop-opacity="0.22"/>
      <stop offset="0.42" stop-color="#1a1225" stop-opacity="0.46"/>
      <stop offset="1" stop-color="#1a1225" stop-opacity="0.95"/>
    </linearGradient>
  </defs>`;

const logo = (y) => `
  <g transform="translate(${MARGIN}, ${y}) scale(0.8)">
    <rect width="64" height="64" rx="14" fill="url(#brand)"/>
    <circle cx="25" cy="17" r="6" fill="${GOLD}"/><circle cx="39" cy="17" r="6" fill="${GOLD}"/>
    <rect x="12" y="20" width="40" height="12" rx="3" fill="#fff"/>
    <rect x="16" y="32" width="32" height="20" rx="3" fill="#fff"/>
    <rect x="28.5" y="20" width="7" height="32" fill="${GOLD}"/>
  </g>
  <text x="${MARGIN + 72}" y="${y + 36}" font-family="Segoe UI" font-size="32" font-weight="700" fill="#ffffff">Дарибот · дарибот.рф</text>`;

async function itemCard(item, index, file) {
  const background = await sharp(dir(`bg/${item.background}.jpg`))
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .toBuffer();

  const nameLines = item.name.split("\n");
  const noteLines = wrap(item.note, 34, SIZE - MARGIN * 2);

  // Считаем снизу вверх: внизу затемнение, и текст должен сидеть в нём, а
  // не наползать на светлую часть кадра.
  const nameTop = SIZE - 250 - noteLines.length * 44 - nameLines.length * 70;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${brandDefs}
    <rect width="${SIZE}" height="${SIZE}" fill="url(#scrim)"/>
    <rect width="${SIZE}" height="12" fill="url(#brand)"/>
    <circle cx="${MARGIN + 44}" cy="140" r="44" fill="url(#brand)"/>
    <text x="${MARGIN + 44}" y="155" text-anchor="middle" font-family="Segoe UI" font-size="44" font-weight="700" fill="#ffffff">${index}</text>
    ${nameLines.map((l, i) => `<text x="${MARGIN}" y="${nameTop + i * 70}" font-family="Segoe UI" font-size="62" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join("")}
    ${noteLines.map((l, i) => `<text x="${MARGIN}" y="${nameTop + nameLines.length * 70 + 14 + i * 44}" font-family="Segoe UI" font-size="34" font-weight="400" fill="#ffffff" opacity="0.88">${esc(l)}</text>`).join("")}
    <text x="${MARGIN}" y="${SIZE - 180}" font-family="Segoe UI" font-size="62" font-weight="700" fill="#ffffff">${esc(item.price)}</text>
    ${logo(SIZE - 140)}
  </svg>`;

  await sharp(background)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(file);
}

for (const [i, item] of ITEMS.entries()) {
  const file = dir(`out/strange/${i + 1}-${item.background.split("-")[1]}.png`);
  await itemCard(item, i + 1, file);
  console.log(`${i + 1}-${item.background.split("-")[1]}.png — ${item.name.replace("\n", " ")}`);
}

console.log(
  "\nготово: cards/out/strange/\n" +
    "Обложка — cards/out/2026-09-30-strange.png, грузить первой.",
);
