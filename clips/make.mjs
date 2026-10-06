// Вертикальный клип «находки» из товаров нашего каталога.
//
// Для ВК Клипов и Телеграма. Без озвучки пока — и это осознанное временное
// решение, не финал: закадровый голос и субтитры нужны, но Yandex SpeechKit
// требует отдельной роли на сервисном аккаунте (см. scripts/tts-test.mjs),
// и пока роль не проверена и не выдана, подключать его рано. Трендовый клип
// и без голоса держится на звуке — музыку накладывают в редакторе ВК при
// загрузке, из встроенной библиотеки, в момент публикации, когда видно,
// что сейчас в тренде.
//
// ПРИБЛИЖЕНИЕ НЕ ИСПОЛЬЗУЕТСЯ. Раньше каждая карточка плавно наезжала
// (zoompan) — попросили убрать насовсем, это решение постоянное, не на один
// клип. Движение теперь только в переходах между карточками (xfade,
// перекрёстное растворение), сама фотография внутри кадра неподвижна.
//
// Шрифты и цвет — те же, что на сайте: Unbounded для заголовков и цены,
// Nunito для остального, фирменный градиент розовый→фиолетовый на ключевых
// словах (как gradient-brand-text в globals.css), и тот же нарисованный
// значок подарка, что в шапке сайта и на карточках постов, — не эмодзи.
//
// Темы собраны в CLIPS ниже, по ключу поста из src/lib/social/plan.ts —
// так же, как карточки в cards/make.mjs выбираются по id. Источник цен,
// названий и фото — scripts/post-photos.mjs: он же качает снимки по
// идентификатору товара в posts/<ключ>/ и печатает прямой адрес каждого
// в links.txt, этот адрес отсюда и берётся.
//
// У каждого товара в выгрузке ровно одна фотография — Такпродам отдаёт
// единственное поле image_url, без галереи. «Несколько разных картинок
// одного товара», как в карточке на маркетплейсе, отсюда не собрать: это
// значило бы либо выдумывать кадры, либо лезть на саму страницу товара
// и тянуть оттуда лишнее — отдельный разговор, если понадобится.
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

/** Длина перехода между карточками. Короче — резко, длиннее — вяло. */
const CROSS = 0.4;

/**
 * Сколько снизу занимает интерфейс ВК: кнопки, описание, имя сообщества.
 * Туда нельзя класть ничего, что нужно прочесть.
 */
const VK_UI = 300;

const CREAM = "#fff8f3";
const INK = "#2b1b3d";
const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";
const GOLD = "#ffb020";

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
      // Было «Садовый секатор» (id 3320820) — фото оказалось напальчником
      // для сбора урожая, другим инструментом того же продавца: карточка
      // магазина сама перепутала снимок и название. Заменил на товар,
      // который проверил глазами лично.
      { name: "Недатированный ежедневник", price: 108, note: "Начать можно в любой день, не ждёт января", url: "https://ir.ozone.ru/s3/multimedia-1-a/15355065322.jpg" },
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

/**
 * Шрифты сайта, встроенные в SVG как есть.
 *
 * Файлы читаем с диска один раз, а не ходим за ними в Google Fonts при
 * каждой сборке: CDN сегодня весь день недоступен из-за VPN — та же судьба
 * постигла базу и YandexART, — а локальный файл этого риска не несёт.
 */
const FONT_DIR = dir("../assets/fonts/");
const b64 = (file) => readFileSync(`${FONT_DIR}${file}`).toString("base64");

const FONT_FACES = `
  <style>
    @font-face { font-family: 'Unbounded'; font-weight: 600; src: url(data:font/ttf;base64,${b64("Unbounded-SemiBold.ttf")}) format('truetype'); }
    @font-face { font-family: 'Unbounded'; font-weight: 700; src: url(data:font/ttf;base64,${b64("Unbounded-Bold.ttf")}) format('truetype'); }
    @font-face { font-family: 'Unbounded'; font-weight: 800; src: url(data:font/ttf;base64,${b64("Unbounded-ExtraBold.ttf")}) format('truetype'); }
    @font-face { font-family: 'Nunito'; font-weight: 400; src: url(data:font/ttf;base64,${b64("Nunito-Regular.ttf")}) format('truetype'); }
    @font-face { font-family: 'Nunito'; font-weight: 600; src: url(data:font/ttf;base64,${b64("Nunito-SemiBold.ttf")}) format('truetype'); }
    @font-face { font-family: 'Nunito'; font-weight: 700; src: url(data:font/ttf;base64,${b64("Nunito-Bold.ttf")}) format('truetype'); }
    @font-face { font-family: 'Nunito'; font-weight: 800; src: url(data:font/ttf;base64,${b64("Nunito-ExtraBold.ttf")}) format('truetype'); }
  </style>`;

/** Общая подложка: фирменные разводы и полоса сверху. */
function backdrop() {
  return `
  <defs>
    ${FONT_FACES}
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

/**
 * Подпись с брендом — над зоной, которую перекрывает интерфейс ВК.
 *
 * Значок нарисован, не эмодзи: ровно тот же рисунок, что в шапке сайта и
 * на карточках постов (cards/make.mjs) — коробка в градиенте, золотой бант,
 * белая лента крест-накрест.
 */
function mark() {
  return `
  <g transform="translate(70, ${H - VK_UI - 130})">
    <rect width="64" height="64" rx="14" fill="url(#brand)"/>
    <circle cx="25" cy="17" r="6" fill="${GOLD}"/>
    <circle cx="39" cy="17" r="6" fill="${GOLD}"/>
    <rect x="12" y="20" width="40" height="12" rx="3" fill="#fff"/>
    <rect x="16" y="32" width="32" height="20" rx="3" fill="#fff"/>
    <rect x="28.5" y="20" width="7" height="32" fill="${GOLD}"/>
  </g>
  <text x="150" y="${H - VK_UI - 84}" font-family="Nunito" font-size="38" font-weight="700" fill="${INK}">Дарибот</text>
  <text x="150" y="${H - VK_UI - 48}" font-family="Nunito" font-size="27" font-weight="400" fill="${INK}" opacity="0.55">подбор подарков с ИИ · дарибот.рф</text>`;
}

/**
 * Перенос по словам. Ширину символа берём приближённо, но не наугад: 0.58
 * измерено напрямую — рендерили «5 находок до 500 ₽» и несколько похожих
 * строк в Unbounded и Nunito и смотрели настоящую ширину в пикселях
 * (trim() у sharp). Вышло 0.53–0.59 в зависимости от строки, берём верхнюю
 * границу с запасом: лучше перенести на символ раньше, чем пусть текст
 * вылезет за край кадра, как было с подзаголовком при прежней константе.
 */
const CHAR_WIDTH = 0.58;

function wrap(text, size, maxWidth) {
  const limit = Math.floor(maxWidth / (size * CHAR_WIDTH));
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
 * Размер заголовка по длине текста.
 *
 * Без этого короткий заголовок с ценой на конце («5 находок до 500 ₽»)
 * переносился по словам буквально — и «₽» оставался один на второй строке,
 * одна монетка висит некрасиво. Чем длиннее заголовок, тем мельче кегль, и
 * перенос либо не нужен вовсе, либо делит текст на строки примерно поровну.
 */
function pickTitleSize(text) {
  if (text.length <= 14) return 104;
  if (text.length <= 20) return 86;
  if (text.length <= 28) return 74;
  return 64;
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
  const size = pickTitleSize(title);
  const lineHeight = Math.round(size * 1.19);
  const lines = wrap(title, size, W - 140);
  // Заголовок — градиент бренда на тексте, как gradient-brand-text на
  // сайте: ключевая фраза, а не ровная чёрная строка.
  const head = lines
    .map((l, i) => `<text x="70" y="${660 + i * lineHeight}" font-family="Unbounded" font-size="${size}" font-weight="800" fill="url(#brand)">${esc(l)}</text>`)
    .join("");

  const subLines = wrap(subtitle, 40, W - 140);
  const subTop = 660 + lines.length * lineHeight + 30;
  const sub = subLines
    .map((l, i) => `<text x="70" y="${subTop + i * 54}" font-family="Nunito" font-size="40" font-weight="600" fill="${INK}" opacity="0.65">${esc(l)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    ${head}
    ${sub}
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function itemFrame(item, index, file) {
  const photo = await fetchPhoto(item.url);

  // Фотографию кладём на белую карточку: у товаров фон то белый, то серый,
  // и без карточки кадры выглядят разнородно. Карточка неподвижна весь кадр
  // — никакого наезда, так решили насовсем.
  const card = await sharp(Buffer.from(photo))
    .resize(660, 660, { fit: "contain", background: "#ffffff" })
    .toBuffer();

  const nameLines = wrap(item.name, 58, W - 160);
  const name = nameLines
    .map((l, i) => `<text x="70" y="${1216 + i * 70}" font-family="Unbounded" font-size="58" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const below = 1216 + nameLines.length * 70;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    <rect x="128" y="288" width="824" height="824" rx="56" fill="url(#brand)"/>
    <rect x="150" y="310" width="780" height="780" rx="44" fill="#ffffff"/>
    <circle cx="190" cy="228" r="54" fill="url(#brand)"/>
    <text x="190" y="248" text-anchor="middle" font-family="Unbounded" font-size="46" font-weight="700" fill="#ffffff">${index}</text>
    ${name}
    <text x="70" y="${below + 22}" font-family="Nunito" font-size="38" font-weight="500" fill="${INK}" opacity="0.6">${esc(item.note)}</text>
    <text x="70" y="${below + 126}" font-family="Unbounded" font-size="80" font-weight="800" fill="url(#brand)">${item.price.toLocaleString("ru")} ₽</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: card, top: 370, left: 210 }])
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
  frames.push({ file: tmp("00.png"), seconds: 2.2 });

  for (const [i, item] of clip.items.entries()) {
    const file = tmp(`${String(i + 1).padStart(2, "0")}.png`);
    await itemFrame(item, i + 1, file);
    frames.push({ file, seconds: PER_SLIDE });
    console.log(`  кадр ${i + 1}: ${item.name}`);
  }

  const inputs = [];
  const parts = [];

  frames.forEach((frame, i) => {
    // Каждый кадр — свой видеопоток постоянной длины, без зацикленного
    // наезда: раньше здесь стоял zoompan, его больше нет и не будет.
    // -framerate напрямую на зацикленную картинку даёт ровно нужное число
    // кадров без лишней арифметики.
    inputs.push("-framerate", "30", "-loop", "1", "-t", String(frame.seconds), "-i", frame.file);
    parts.push(`[${i}:v]format=yuv420p,setsar=1[s${i}]`);
  });

  // Перекрёстное растворение между соседними карточками, цепочкой: каждый
  // следующий xfade берёт на вход уже смонтированный кусок, а не исходный
  // кадр. Смещение — это точка в объединённой до сих пор длине, где должен
  // начаться переход к следующей карточке: конец текущего отрезка минус
  // длина самого перехода.
  let label = "s0";
  let cursor = frames[0].seconds;

  for (let i = 1; i < frames.length; i++) {
    const next = `x${i}`;
    const offset = (cursor - CROSS).toFixed(3);
    parts.push(`[${label}][s${i}]xfade=transition=fade:duration=${CROSS}:offset=${offset}[${next}]`);
    cursor = cursor + frames[i].seconds - CROSS;
    label = next;
  }

  const filterFile = tmp("filter.txt");
  writeFileSync(filterFile, parts.join(";"));

  const out = dir(`out/${clip.out}.mp4`);

  execFileSync(
    FFMPEG,
    [
      "-y", ...inputs,
      "-/filter_complex", filterFile,
      "-map", `[${label}]`,
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
  console.log(`длина: ${cursor.toFixed(1)} с\n`);
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
