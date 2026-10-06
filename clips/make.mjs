// Вертикальный клип «находки» из товаров нашего каталога.
//
// Для ВК Клипов и Телеграма. Без озвучки — и это главное решение здесь.
//
// Трендовый клип держится на звуке: попадание в рекомендации даёт музыка,
// которую накладывают в редакторе ВК при загрузке, из встроенной библиотеки.
// Закадровый голос с ней спорит — слышно либо одно, либо другое. Поэтому всё,
// что надо сказать, написано на экране, а звук выбирается в момент
// публикации, когда видно, что сейчас в тренде.
//
// Темы собраны в CLIPS ниже, по ключу поста из src/lib/social/plan.ts —
// так же, как карточки в cards/make.mjs выбираются по id. Источник цен,
// названий и фото — scripts/post-photos.mjs: он же качает снимки по
// идентификатору товара в posts/<ключ>/ и печатает прямой адрес каждого
// в links.txt, этот адрес отсюда и берётся.
//
// Запуск: node clips/make.mjs <ключ>   (с ВЫКЛЮЧЕННЫМ VPN — фото свои)
//    или: node clips/make.mjs          — соберёт все темы по очереди

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const FFMPEG =
  "C:/Users/Master/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe";

// Вертикаль 9:16 — единственный формат, который ВК показывает в Клипах.
const W = 1080;
const H = 1920;

/** Сколько держится один товар. Меньше пяти секунд прочитать не успевают. */
const PER_SLIDE = 5;

/**
 * Сколько снизу занимает интерфейс ВК: кнопки, описание, имя сообщества.
 * Туда нельзя класть ничего, что нужно прочесть.
 */
const VK_UI = 300;

const CREAM = "#fff8f3";
const INK = "#2b1b3d";
const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";

/**
 * Темы клипов.
 *
 * `out` — имя файла в clips/out/, без расширения. Пять позиций в ITEMS —
 * не жёсткое число, но меньше выглядит бедно, а больше не держат внимание:
 * по PER_SLIDE секунд на штуку ролик и так растягивается почти на полминуты.
 */
const CLIPS = {
  "2026-10-11-nahodki-500": {
    out: "nahodki-do-500",
    title: "5 находок до 500 ₽",
    subtitle: "ничего случайного, всё по ссылке в профиле",
    items: [
      { name: "Гирлянда на батарейках", price: 71, note: "На полку, на окно, в детскую", url: "https://ir.ozone.ru/s3/multimedia-1-x/15066063069.jpg" },
      { name: "Садовый секатор", price: 51, note: "Для того, кто уже просил именно это", url: "https://ir.ozone.ru/s3/multimedia-1-e/13683851438.jpg" },
      { name: "Ароматическая свеча в банке", price: 244, note: "Соевый воск держит запах дольше парафина", url: "https://ir.ozone.ru/s3/multimedia-1-i/6957079218.jpg" },
      { name: "Термокружка с крышкой", price: 221, note: "Горячее дольше, чем в открытой чашке", url: "https://ir.ozone.ru/s3/multimedia-1-k/9681718268.jpg" },
      { name: "Когтеточка самоклеящаяся", price: 245, note: "Если в доме уже страдает угол", url: "https://ir.ozone.ru/s3/multimedia-1-2/15460182938.jpg" },
    ],
  },
  "2026-10-14-nahodki-wide": {
    out: "nahodki-250-2500",
    title: "5 находок от 250 до 2500 ₽",
    subtitle: "для любого бюджета, всё по ссылке в профиле",
    items: [
      { name: "Ароматическая свеча в банке", price: 257, note: "«Сладкая хурма» — осенний вариант", url: "https://ir.ozone.ru/s3/multimedia-1-x/6906698097.jpg" },
      { name: "Термокружка подарочная", price: 342, note: "350 мл, держит и горячее, и холодное", url: "https://cdn1.ozone.ru/s3/multimedia-1-r/20012948307.jpg" },
      { name: "Деревянный органайзер для ручек", price: 1586, note: "Одна работа — и справляется с ней десятилетиями", url: "https://cdn1.ozone.ru/s3/multimedia-1-t/7297925321.jpg" },
      { name: "Портативная колонка Xiaomi", price: 1107, note: "В сумку, на дачу, в ванную", url: "https://mi-shop.com/upload/iblock/b1f/ib28rnvj4s43j1nzyfygj4ghf0zkox50.png" },
      { name: "Серебряная цепочка 925 пробы", price: 2560, note: "Простая форма — носят каждый день", url: "https://ir.ozone.ru/s3/multimedia-1-p/14806827493.jpg" },
    ],
  },
};

// Кириллица в имени файла иначе приезжает в виде %D0%BF%D1%80: URL её
// кодирует, а файловой системе это не нужно.
const dir = (name) =>
  decodeURIComponent(new URL(name, import.meta.url).pathname.slice(1));

mkdirSync(dir("out/"), { recursive: true });
mkdirSync(dir("tmp/"), { recursive: true });

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/** Общая подложка: фирменные разводы и полоса сверху. */
function backdrop() {
  return `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${PINK}"/><stop offset="1" stop-color="${VIOLET}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${VIOLET}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${PINK}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${PINK}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${CREAM}"/>
  <circle cx="${W - 60}" cy="240" r="520" fill="url(#glow)"/>
  <circle cx="40" cy="${H - 200}" r="480" fill="url(#glow2)"/>
  <rect width="${W}" height="14" fill="url(#brand)"/>`;
}

/** Подпись с брендом — над зоной, которую перекрывает интерфейс ВК. */
function mark() {
  return `
  <text x="70" y="${H - VK_UI - 54}" font-family="Segoe UI" font-size="40" font-weight="700" fill="${INK}">🎁 Дарибот</text>
  <text x="70" y="${H - VK_UI - 10}" font-family="Segoe UI" font-size="30" font-weight="400" fill="${INK}" opacity="0.5">дарибот.рф</text>`;
}

/** Перенос по словам — метрик у нас нет, ширину символа берём приближённо. */
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

/**
 * Скачивание фотографии товара.
 *
 * Путь вместо адреса — значит, картинка своя и лежит рядом. Пригождается и
 * для проверки сборки, когда магазины недоступны.
 *
 * С повторами: магазины отвечают не всегда с первого раза. А если не
 * отвечают вовсе — почти наверняка включён VPN, магазины его не любят ровно
 * так же, как наш собственный сервер.
 */
async function fetchPhoto(url) {
  if (!/^https?:\/\//.test(url)) return readFileSync(url);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`магазин ответил ${res.status}`);
      return await res.arrayBuffer();
    } catch (error) {
      if (attempt === 3) {
        throw new Error(
          `не скачалась фотография ${url}\n` +
            `Причина: ${String(error instanceof Error ? error.message : error)}\n` +
            "Если это таймаут — выключите VPN и запустите ещё раз.",
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function titleFrame(title, subtitle, file) {
  const lines = wrap(title, 110, W - 180);
  const head = lines
    .map((l, i) => `<text x="70" y="${700 + i * 130}" font-family="Segoe UI" font-size="110" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    ${head}
    <text x="70" y="${700 + lines.length * 130 + 20}" font-family="Segoe UI" font-size="46" font-weight="400" fill="${INK}" opacity="0.6">${esc(subtitle)}</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function itemFrame(item, index, file) {
  const photo = await fetchPhoto(item.url);

  // Фотографию кладём на белую карточку: у товаров фон то белый, то серый,
  // и без карточки кадры выглядят разнородно.
  const card = await sharp(Buffer.from(photo))
    .resize(680, 680, { fit: "contain", background: "#ffffff" })
    .toBuffer();

  const nameLines = wrap(item.name, 64, W - 160);
  const name = nameLines
    .map((l, i) => `<text x="70" y="${1210 + i * 76}" font-family="Segoe UI" font-size="64" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const below = 1210 + nameLines.length * 76;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    <rect x="140" y="300" width="800" height="800" rx="48" fill="#ffffff"/>
    <circle cx="190" cy="228" r="54" fill="url(#brand)"/>
    <text x="190" y="246" text-anchor="middle" font-family="Segoe UI" font-size="52" font-weight="700" fill="#ffffff">${index}</text>
    ${name}
    <text x="70" y="${below + 20}" font-family="Segoe UI" font-size="40" font-weight="400" fill="${INK}" opacity="0.62">${esc(item.note)}</text>
    <text x="70" y="${below + 120}" font-family="Segoe UI" font-size="86" font-weight="700" fill="${PINK}">${item.price.toLocaleString("ru")} ₽</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: card, top: 360, left: 200 }])
    .png()
    .toFile(file);
}

async function buildClip(key, clip) {
  // Кадры конкретной темы держим в своей подпапке tmp/: сборка двух клипов
  // подряд иначе затирала бы кадры друг друга на середине работы.
  const tmp = (name) => dir(`tmp/${key}/${name}`);
  mkdirSync(tmp(""), { recursive: true });

  const frames = [];

  await titleFrame(clip.title, clip.subtitle, tmp("00.png"));
  frames.push({ file: tmp("00.png"), seconds: 2.5 });

  for (const [i, item] of clip.items.entries()) {
    const file = tmp(`${String(i + 1).padStart(2, "0")}.png`);
    await itemFrame(item, i + 1, file);
    frames.push({ file, seconds: PER_SLIDE });
    console.log(`  кадр ${i + 1}: ${item.name}`);
  }

  const inputs = [];
  const parts = [];

  frames.forEach((frame, i) => {
    // Ровно один кадр на слайд.
    //
    // zoompan выдаёт d кадров на КАЖДЫЙ входной. Если подать зацикленную
    // картинку как поток на пять секунд, войдёт сто пятьдесят одинаковых
    // кадров и выйдет сто пятьдесят на сто пятьдесят — двадцать две тысячи
    // вместо ста пятидесяти. Так ролик в полминуты считался двадцать пять
    // минут, пока я не разобрался.
    //
    // Сужающейся обрезкой то же самое не сделать: crop вычисляет размер один
    // раз при настройке, и времени в этот момент ещё нет.
    inputs.push("-framerate", "1", "-loop", "1", "-t", "1", "-i", frame.file);

    const d = Math.round(frame.seconds * 30);
    parts.push(
      `[${i}:v]zoompan=z='min(1+0.0009*on,1.12)':d=${d}:` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=30,setsar=1[v${i}]`,
    );
  });

  const chain = frames.map((_, i) => `[v${i}]`).join("");
  const filterFile = tmp("filter.txt");
  writeFileSync(
    filterFile,
    `${parts.join(";")};${chain}concat=n=${frames.length}:v=1:a=0[out]`,
  );

  const out = dir(`out/${clip.out}.mp4`);

  execFileSync(
    FFMPEG,
    [
      "-y", ...inputs,
      "-/filter_complex", filterFile,
      "-map", "[out]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-r", "30",
      // Оглавление в начало файла: иначе ВК и телеграм начинают показывать
      // ролик только после того, как скачают его целиком.
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  console.log(`готово: ${out}`);
  console.log(`длина: ${frames.reduce((s, f) => s + f.seconds, 0)} с\n`);
}

const requested = process.argv[2];
const keys = requested ? [requested] : Object.keys(CLIPS);

for (const key of keys) {
  const clip = CLIPS[key];
  if (!clip) {
    console.log(`нет такой темы: ${key}\nесть: ${Object.keys(CLIPS).join(", ")}`);
    continue;
  }
  console.log(`=== ${key} ===`);
  await buildClip(key, clip);
}

console.log("Музыку накладывайте в редакторе ВК при загрузке — берите то, что в тренде сейчас.");
