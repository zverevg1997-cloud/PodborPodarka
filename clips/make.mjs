// Вертикальный клип «находки» из товаров нашего каталога.
//
// Для ВК Клипов и Телеграма. Без озвучки — и это главное решение здесь.
//
// Трендовый клип держится на звуке: попадание в рекомендации даёт музыка,
// которую накладывают в редакторе ВК при загрузке, из встроенной
// библиотеки. Закадровый голос с ней спорит — слышно либо одно, либо
// другое. Поэтому всё, что надо сказать, написано на экране, а звук
// выбирается в момент публикации, когда видно, что сейчас в тренде.
//
// Запуск: node clips/make.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const FFMPEG =
  "C:/Users/Master/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe";

// Вертикаль 9:16 — единственный формат, который ВК показывает в Клипах.
const W = 1080;
const H = 1920;

/** Сколько держится один товар. Меньше пяти секунд прочитать не успевают. */
const PER_SLIDE = 5;

const CREAM = "#fff8f3";
const INK = "#2b1b3d";
const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";

const TITLE = "5 подарков до 2000 ₽";
const SUBTITLE = "которые не выглядят дёшево";

const ITEMS = [
  { name: "Датчик температуры и влажности", price: 941, note: "Покажет, почему дома душно", url: "https://mi-shop.com/upload/iblock/8ae/mcu0rmy5s3e07nub1ei3rw8oxnd31w1d.png" },
  { name: "Портативная колонка", price: 1131, note: "В сумку, на дачу, в ванную", url: "https://mi-shop.com/upload/iblock/957/rhq6mnyu0tsgu04kjvlzvkmh4xlwxqb9.png" },
  { name: "Термокружка", price: 1399, note: "Горячее шесть часов, а не сорок минут", url: "https://shop-polaris.ru/upload/iblock/ad8/Kontur-500TM-A.jpg" },
  { name: "Настольная лампа", price: 1416, note: "Для тех, кто работает по вечерам", url: "https://mi-shop.com/upload/iblock/50b/50b9438a568f4e033875d8e7a2489d49.jpg" },
  { name: "Увлажнитель воздуха", price: 2110, note: "С октября по апрель — незаменим", url: "https://shop-polaris.ru/upload/iblock/cd4/PUH%205004_K01-min.jpg" },
];

const dir = (name) => new URL(name, import.meta.url).pathname.slice(1);
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

/** Подпись с брендом внизу — одинаковая на всех кадрах. */
function mark() {
  return `
  <text x="60" y="${H - 96}" font-family="Segoe UI" font-size="40" font-weight="700" fill="${INK}">🎁 Дарибот</text>
  <text x="60" y="${H - 52}" font-family="Segoe UI" font-size="30" font-weight="400" fill="${INK}" opacity="0.5">подбор подарков с ИИ · дарибот.рф</text>`;
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

async function titleFrame(file) {
  const lines = wrap(TITLE, 110, W - 120);
  const head = lines
    .map((l, i) => `<text x="60" y="${760 + i * 130}" font-family="Segoe UI" font-size="110" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    ${head}
    <text x="60" y="${760 + lines.length * 130 + 20}" font-family="Segoe UI" font-size="46" font-weight="400" fill="${INK}" opacity="0.6">${esc(SUBTITLE)}</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

/**
 * Скачивание фотографии товара.
 *
 * С повторами: магазины отвечают не всегда с первого раза. А если не
 * отвечают вовсе — почти наверняка включён VPN, магазины его не любят
 * ровно так же, как наш собственный сервер.
 */
async function fetchPhoto(url) {
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

async function itemFrame(item, index, file) {
  const photo = await fetchPhoto(item.url);

  // Фотографию кладём на белую карточку: у товаров фон то белый, то серый,
  // и без карточки кадры выглядят разнородно.
  const card = await sharp(Buffer.from(photo))
    .resize(760, 760, { fit: "contain", background: "#ffffff" })
    .toBuffer();

  const nameLines = wrap(item.name, 64, W - 120);
  const name = nameLines
    .map((l, i) => `<text x="60" y="${1330 + i * 76}" font-family="Segoe UI" font-size="64" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const below = 1330 + nameLines.length * 76;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    <rect x="100" y="340" width="880" height="880" rx="48" fill="#ffffff"/>
    <circle cx="150" cy="270" r="54" fill="url(#brand)"/>
    <text x="150" y="288" text-anchor="middle" font-family="Segoe UI" font-size="52" font-weight="700" fill="#ffffff">${index}</text>
    ${name}
    <text x="60" y="${below + 30}" font-family="Segoe UI" font-size="40" font-weight="400" fill="${INK}" opacity="0.62">${esc(item.note)}</text>
    <text x="60" y="${below + 130}" font-family="Segoe UI" font-size="86" font-weight="700" fill="${PINK}">${item.price.toLocaleString("ru")} ₽</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: card, top: 400, left: 160 }])
    .png()
    .toFile(file);
}

const frames = [];

await titleFrame(dir("tmp/00.png"));
frames.push({ file: dir("tmp/00.png"), seconds: 2.5 });

for (const [i, item] of ITEMS.entries()) {
  const file = dir(`tmp/${String(i + 1).padStart(2, "0")}.png`);
  await itemFrame(item, i + 1, file);
  frames.push({ file, seconds: PER_SLIDE });
  console.log(`кадр ${i + 1}: ${item.name}`);
}

// Медленный наезд на каждый кадр: статичная картинка пять секунд читается
// как зависшее видео, а не как клип.
const inputs = [];
const parts = [];

frames.forEach((frame, i) => {
  inputs.push("-loop", "1", "-t", String(frame.seconds), "-i", frame.file);
  const d = Math.round(frame.seconds * 30);
  parts.push(
    `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='min(zoom+0.0008,1.12)':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=30,setsar=1[v${i}]`,
  );
});

const chain = frames.map((_, i) => `[v${i}]`).join("");
const filter = `${parts.join(";")};${chain}concat=n=${frames.length}:v=1:a=0[out]`;

writeFileSync(dir("tmp/filter.txt"), filter);

const out = dir("out/nahodki-do-2000.mp4");

execFileSync(
  FFMPEG,
  [
    "-y", ...inputs,
    "-/filter_complex", dir("tmp/filter.txt"),
    "-map", "[out]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-pix_fmt", "yuv420p", "-r", "30",
    out,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

console.log(`\nготово: ${out}`);
console.log(`длина: ${frames.reduce((s, f) => s + f.seconds, 0)} с`);
console.log("Музыку накладывайте в редакторе ВК при загрузке — берите то, что в тренде сейчас.");
