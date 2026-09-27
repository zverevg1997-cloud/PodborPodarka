// Карусель к посту «Что подарить за 1000 ₽, кроме вещей».
//
// Первая карточка объясняет мысль поста целиком — её видят все, включая
// тех, кто дальше не листает. Остальные шесть по позициям: фотография
// места, цена и одна фраза о том, кому это подойдёт.
//
// Фотографии настоящие, из выгрузки БоксДари. Две позиции из первого
// варианта поста пришлось заменить: у них в выгрузке вместо снимка стояла
// заглушка flowwow.jpg, одна и та же на оба. Показывать чужую картинку под
// видом места — ровно то, чего мы в постах и не делаем.
//
// Запуск: node cards/carousel.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SIZE = 1080;
const MARGIN = 72;

const CREAM = "#fff8f3";
const INK = "#2b1b3d";
const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";
const GOLD = "#ffb020";

const ITEMS = [
  {
    name: "Смотровая площадка\nСмольного собора",
    price: 380,
    note: "Подняться под купол и увидеть город сверху",
    picture: "https://boxdari.ru/upload/iblock/f61/xft4xdk2h37ydeht26y7ck2m1wo9qx0s/tripster_banner_6996a6f511c9a0.99905935.jpg",
  },
  {
    name: "Обзорная экскурсия\nпо Петербургу",
    price: 440,
    note: "Для тех, кто живёт в городе и не был в его главных местах",
    picture: "https://boxdari.ru/upload/iblock/9eb/ib2sr4a02gkl5lu98yemhv8a08550hr8/tripster_banner_69969b34772480.81629974.jpg",
  },
  {
    name: "Музей\nретро-автомобилей",
    price: 500,
    note: "Работает и для того, кто «в машинах не разбирается»",
    picture: "https://boxdari.ru/upload/iblock/940/7ziamyv6w6frnxooiiz1mlym0u1ebfct.jpg",
  },
  {
    name: "Инженерный\nмастер-класс",
    price: 570,
    note: "Собрать робота руками. Для ребёнка это событие",
    picture: "https://boxdari.ru/upload/iblock/bdc/07n965gazkk0u22afkqb0wzzm8pwa3a3/tripster_banner_6992eda1dcb404.13627815.jpg",
  },
  {
    name: "Зоопарк\nZooЛэнд",
    price: 600,
    note: "Подарок не вещью, а выходным вместе",
    picture: "https://boxdari.ru/upload/iblock/24e/flze2zj26np4gnoom4e50gqwylbbno2c.jpg",
  },
  {
    name: "Квест-экскурсия\nбез гида",
    price: 650,
    note: "Подсказки в телефоне, свой темп. Заходит подросткам",
    picture: "https://boxdari.ru/upload/iblock/056/hsakqhko75liybeaz02lyy160h6ssr34/tripster_banner_6992f40aea05c9.67395919.jpg",
  },
];

const dir = (name) =>
  decodeURIComponent(new URL(name, import.meta.url).pathname.slice(1));

mkdirSync(dir("out/carousel/"), { recursive: true });

const esc = (t) =>
  t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function wrap(text, size, maxWidth) {
  const limit = Math.floor(maxWidth / (size * 0.53));
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > limit && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchPhoto(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`ответ ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === 3) {
        throw new Error(
          `не скачалась ${url}\n${String(error instanceof Error ? error.message : error)}\n` +
            "Если это таймаут — выключите VPN и запустите ещё раз.",
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const brandDefs = `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${PINK}"/><stop offset="1" stop-color="${VIOLET}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1a1225" stop-opacity="0.22"/>
      <stop offset="0.42" stop-color="#1a1225" stop-opacity="0.44"/>
      <stop offset="1" stop-color="#1a1225" stop-opacity="0.94"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${VIOLET}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

const logo = (y, light) => `
  <g transform="translate(${MARGIN}, ${y}) scale(0.8)">
    <rect width="64" height="64" rx="14" fill="url(#brand)"/>
    <circle cx="25" cy="17" r="6" fill="${GOLD}"/><circle cx="39" cy="17" r="6" fill="${GOLD}"/>
    <rect x="12" y="20" width="40" height="12" rx="3" fill="#fff"/>
    <rect x="16" y="32" width="32" height="20" rx="3" fill="#fff"/>
    <rect x="28.5" y="20" width="7" height="32" fill="${GOLD}"/>
  </g>
  <text x="${MARGIN + 72}" y="${y + 36}" font-family="Segoe UI" font-size="32" font-weight="700" fill="${light ? "#ffffff" : INK}">Дарибот · дарибот.рф</text>`;

/** Первая карточка: мысль поста целиком, без фотографии. */
async function coverCard(file) {
  const head = wrap("Подарок за 1000 ₽, который не выглядит дёшево", 82, SIZE - MARGIN * 2);
  const top = 300;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${brandDefs}
    <rect width="${SIZE}" height="${SIZE}" fill="${CREAM}"/>
    <circle cx="${SIZE - 40}" cy="140" r="380" fill="url(#glow)"/>
    <rect width="${SIZE}" height="12" fill="url(#brand)"/>
    ${head.map((l, i) => `<text x="${MARGIN}" y="${top + i * 100}" font-family="Segoe UI" font-size="82" font-weight="700" fill="${INK}">${esc(l)}</text>`).join("")}
    <text x="${MARGIN}" y="${top + head.length * 100 + 40}" font-family="Segoe UI" font-size="38" font-weight="400" fill="${INK}" opacity="0.62">Вещь за тысячу выглядит ровно на свою цену.</text>
    <text x="${MARGIN}" y="${top + head.length * 100 + 92}" font-family="Segoe UI" font-size="38" font-weight="400" fill="${INK}" opacity="0.62">Впечатление — никогда.</text>
    <rect x="${MARGIN}" y="${SIZE - 260}" width="420" height="72" rx="36" fill="url(#brand)"/>
    <text x="${MARGIN + 210}" y="${SIZE - 213}" text-anchor="middle" font-family="Segoe UI" font-size="34" font-weight="700" fill="#ffffff">6 идей — листайте →</text>
    ${logo(SIZE - 140, false)}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function itemCard(item, index, file) {
  const photo = await fetchPhoto(item.picture);

  const background = await sharp(photo)
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .toBuffer();

  const nameLines = item.name.split("\n");
  const noteLines = wrap(item.note, 34, SIZE - MARGIN * 2);

  const nameTop = SIZE - 230 - noteLines.length * 44 - nameLines.length * 70;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${brandDefs}
    <rect width="${SIZE}" height="${SIZE}" fill="url(#scrim)"/>
    <rect width="${SIZE}" height="12" fill="url(#brand)"/>
    <circle cx="${MARGIN + 44}" cy="140" r="44" fill="url(#brand)"/>
    <text x="${MARGIN + 44}" y="${155}" text-anchor="middle" font-family="Segoe UI" font-size="44" font-weight="700" fill="#ffffff">${index}</text>
    ${nameLines.map((l, i) => `<text x="${MARGIN}" y="${nameTop + i * 70}" font-family="Segoe UI" font-size="64" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join("")}
    ${noteLines.map((l, i) => `<text x="${MARGIN}" y="${nameTop + nameLines.length * 70 + 14 + i * 44}" font-family="Segoe UI" font-size="34" font-weight="400" fill="#ffffff" opacity="0.88">${esc(l)}</text>`).join("")}
    <text x="${MARGIN}" y="${SIZE - 180}" font-family="Segoe UI" font-size="76" font-weight="700" fill="#ffffff">${item.price} ₽</text>
    ${logo(SIZE - 140, true)}
  </svg>`;

  await sharp(background)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(file);
}

await coverCard(dir("out/carousel/0-oblozhka.png"));
console.log("0-oblozhka.png — обобщающая");

for (const [i, item] of ITEMS.entries()) {
  const file = dir(`out/carousel/${i + 1}-${item.price}.png`);
  await itemCard(item, i + 1, file);
  console.log(`${i + 1}-${item.price}.png — ${item.name.replace("\n", " ")}`);
}

console.log("\nготово: cards/out/carousel/ — грузить по порядку номеров");
