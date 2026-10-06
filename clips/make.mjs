// Вертикальный клип «находки» из товаров нашего каталога.
//
// Для ВК Клипов и Телеграма. С закадровым голосом и субтитрами: каждая
// карточка озвучена через Yandex SpeechKit (голос alena), а то же самое
// предложение горит на экране, пока его читают. Голос объясняет не что это
// за вещь — это и так видно на фото и в названии, — а почему это хороший
// подарок именно в этой роли.
//
// Длительность слайда теперь не фиксированная цифра, а выводится из записи:
// слайд держится столько, сколько длится озвучка этого товара, плюс
// небольшая пауза на передышку. Короткая фраза — короткий слайд, длинная —
// длинный; раньше было наоборот, одна цифра на все слайды разом, и текст
// либо скучал на экране, либо не успевал прочитаться.
//
// Про музыку в ВК. Раньше, без голоса, ролик держался на треке из
// библиотеки ВК, который накладывают при публикации. Теперь в кадре уже
// есть речь, и трек поверх нее — это разговор одновременно с музыкой,
// слышно будет хуже, а не лучше. Либо без трека вовсе, либо что-то тихое и
// фоновое, явно позади голоса, а не поверх.
//
// ПРИБЛИЖЕНИЕ НЕ ИСПОЛЬЗУЕТСЯ. Раньше каждая карточка плавно наезжала
// (zoompan) — попросили убрать насовсем, это решение постоянное, не на один
// клип. Движение — в переходах между карточками (xfade, перекрёстное
// растворение, и в озвученной версии — такой же acrossfade у звука), сама
// фотография внутри кадра неподвижна.
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
// Озвучку кэшируем по тексту (clips/tmp/voice-cache/): каждый запуск
// SpeechKit стоит денег, а при подборе раскладки текста перезапускать
// сборку приходится не один раз. Поменялся текст — переозвучится; не
// поменялся — возьмётся готовый файл.
//
// Запуск: node clips/make.mjs <ключ>   (с ВЫКЛЮЧЕННЫМ VPN — фото и голос свои)
//    или: node clips/make.mjs          — соберёт все темы по очереди

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const FFMPEG =
  "C:/Users/Master/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe";
const FFPROBE =
  "C:/Users/Master/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffprobe.exe";

// Вертикаль 9:16 — единственный формат, который ВК показывает в Клипах.
const W = 1080;
const H = 1920;

/** Пауза после того, как голос замолчал, перед тем как резать на следующий кадр. */
const PAD_AFTER_VOICE = 0.5;

/** Короче слайд не делаем, даже если фраза прочиталась мгновенно. */
const MIN_SLIDE = 3.0;

/** Длина перехода между карточками — и в видео, и в звуке, одна и та же. */
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
 * `voice` у позиции — то, что произносит голос и что написано субтитром:
 * не описание товара (это и так видно), а причина, по которой это хороший
 * подарок. `voiceIntro` — то же самое для заглавного кадра.
 */
const CLIPS = {
  "2026-10-11-nahodki-500": {
    out: "nahodki-do-500",
    title: "5 находок до 500 ₽",
    subtitle: "ничего случайного, всё по ссылке в профиле",
    voiceIntro: "Пять находок до пятисот рублей. Ничего случайного — каждая вещь по делу.",
    items: [
      {
        name: "Гирлянда на батарейках", price: 71,
        voice: "Работает без розетки — повесить можно куда угодно: на полку, на окно, в детскую.",
        url: "https://ir.ozone.ru/s3/multimedia-1-x/15066063069.jpg",
      },
      // Было «Садовый секатор» (id 3320820) — фото оказалось напальчником
      // для сбора урожая, другим инструментом того же продавца: карточка
      // магазина сама перепутала снимок и название. Заменил на товар,
      // который проверил глазами лично.
      {
        name: "Недатированный ежедневник", price: 108,
        voice: "Начать вести его можно в любой день, а не ждать января.",
        url: "https://ir.ozone.ru/s3/multimedia-1-a/15355065322.jpg",
      },
      {
        name: "Ароматическая свеча в банке", price: 244,
        voice: "Соевый воск держит аромат дольше обычного парафина.",
        url: "https://ir.ozone.ru/s3/multimedia-1-i/6957079218.jpg",
      },
      {
        name: "Термокружка с крышкой", price: 221,
        voice: "Чай остаётся горячим дольше, чем в открытой чашке.",
        url: "https://ir.ozone.ru/s3/multimedia-1-k/9681718268.jpg",
      },
      {
        name: "Когтеточка самоклеящаяся", price: 245,
        voice: "Клеится прямо на угол, который и так уже страдает от кошачьих когтей.",
        url: "https://ir.ozone.ru/s3/multimedia-1-2/15460182938.jpg",
      },
    ],
  },
  "2026-10-14-nahodki-wide": {
    out: "nahodki-250-2500",
    title: "5 находок от 250 до 2500 ₽",
    subtitle: "для любого бюджета, всё по ссылке в профиле",
    voiceIntro: "Пять находок на любой бюджет — от двухсот пятидесяти до двух с половиной тысяч рублей.",
    items: [
      {
        name: "Ароматическая свеча в банке", price: 257,
        voice: "«Сладкая хурма» — осенний аромат, который подходит почти к любому поводу.",
        url: "https://ir.ozone.ru/s3/multimedia-1-x/6906698097.jpg",
      },
      {
        name: "Термокружка подарочная", price: 342,
        voice: "Держит и горячее, и холодное — пригодится в любое время года.",
        url: "https://cdn1.ozone.ru/s3/multimedia-1-r/20012948307.jpg",
      },
      {
        name: "Деревянный органайзер для ручек", price: 1586,
        voice: "У него одна работа на столе — и он справляется с ней годами.",
        url: "https://cdn1.ozone.ru/s3/multimedia-1-t/7297925321.jpg",
      },
      {
        name: "Портативная колонка Xiaomi", price: 1107,
        voice: "Помещается в сумку — на дачу, в ванную, куда угодно.",
        url: "https://mi-shop.com/upload/iblock/b1f/ib28rnvj4s43j1nzyfygj4ghf0zkox50.png",
      },
      {
        name: "Серебряная цепочка 925 пробы", price: 2560,
        voice: "Простое плетение без подвески — такую носят каждый день, не задумываясь.",
        url: "https://ir.ozone.ru/s3/multimedia-1-p/14806827493.jpg",
      },
    ],
  },
};

// Кириллица в имени файла иначе приезжает в виде %D0%BF%D1%80: URL её
// кодирует, а файловой системе это не нужно.
const dir = (name) =>
  decodeURIComponent(new URL(name, import.meta.url).pathname.slice(1));

mkdirSync(dir("out/"), { recursive: true });
mkdirSync(dir("tmp/"), { recursive: true });
mkdirSync(dir("tmp/voice-cache/"), { recursive: true });

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// .env читаем сами: скрипт лежит не в корне, а переменные (ключ SpeechKit)
// нужны именно отсюда, без похода через серверный код.
const ENV = Object.fromEntries(
  readFileSync(dir("../.env"), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

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

/**
 * Озвучка одной фразы через Yandex SpeechKit, с кэшем по тексту.
 *
 * Кэш — не оптимизация про запас: без него каждая правка раскладки на
 * экране заново платила бы за озвучку, которая при этом не менялась ни на
 * букву.
 */
async function synthesizeVoice(text) {
  const hash = createHash("sha1").update(text).digest("hex").slice(0, 16);
  const file = dir(`tmp/voice-cache/${hash}.mp3`);
  if (existsSync(file)) return file;

  const key = ENV.YANDEX_API_KEY;
  const folder = ENV.YANDEX_FOLDER_ID;
  if (!key || !folder) throw new Error("В .env нет YANDEX_API_KEY или YANDEX_FOLDER_ID");

  const res = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      text, lang: "ru-RU", voice: "alena", folderId: folder, format: "mp3",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`SpeechKit ответил ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Длительность аудиофайла в секундах — ffprobe знает точно, на глаз не угадать. */
function probeDuration(file) {
  const out = execFileSync(FFPROBE, [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]).toString().trim();
  return parseFloat(out);
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

  // Карточка чуть меньше, чем в первой версии: субтитр теперь — полное
  // предложение, а не короткая бирка, и под него нужно больше места по
  // высоте, не заезжая на фирменную подпись внизу.
  const card = await sharp(Buffer.from(photo))
    .resize(600, 600, { fit: "contain", background: "#ffffff" })
    .toBuffer();

  const nameLines = wrap(item.name, 54, W - 160);
  const name = nameLines
    .map((l, i) => `<text x="70" y="${1086 + i * 66}" font-family="Unbounded" font-size="54" font-weight="700" fill="${INK}">${esc(l)}</text>`)
    .join("");

  const afterName = 1086 + nameLines.length * 66;

  // Субтитр — то же предложение, что звучит голосом, не короткая бирка.
  // Высота блока не фиксирована: короткая фраза в одну строку, длинная —
  // в две, и цена ниже сама подстраивается под то, сколько строк вышло.
  const subLines = wrap(item.voice, 36, W - 160);
  const sub = subLines
    .map((l, i) => `<text x="70" y="${afterName + 20 + i * 48}" font-family="Nunito" font-size="36" font-weight="500" fill="${INK}" opacity="0.62">${esc(l)}</text>`)
    .join("");

  const afterSub = afterName + 20 + subLines.length * 48;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${backdrop()}
    <rect x="148" y="236" width="784" height="784" rx="52" fill="url(#brand)"/>
    <rect x="170" y="258" width="740" height="740" rx="40" fill="#ffffff"/>
    <circle cx="190" cy="196" r="52" fill="url(#brand)"/>
    <text x="190" y="215" text-anchor="middle" font-family="Unbounded" font-size="44" font-weight="700" fill="#ffffff">${index}</text>
    ${name}
    ${sub}
    <text x="70" y="${afterSub + 86}" font-family="Unbounded" font-size="72" font-weight="800" fill="url(#brand)">${item.price.toLocaleString("ru")} ₽</text>
    ${mark()}
  </svg>`;

  await sharp(Buffer.from(svg))
    .composite([{ input: card, top: 328, left: 240 }])
    .png()
    .toFile(file);
}

async function buildClip(key, clip) {
  // Кадры конкретной темы держим в своей подпапке tmp/: сборка двух клипов
  // подряд иначе затирала бы кадры друг друга на середине работы. voice-cache
  // — исключение, он общий на все темы и не чистится между сборками.
  const tmp = (name) => dir(`tmp/${key}/${name}`);
  mkdirSync(tmp(""), { recursive: true });

  const frames = [];

  // Заглавный кадр: озвучка задаёт длительность, не фиксированная цифра.
  const introVoice = await synthesizeVoice(clip.voiceIntro);
  const introSeconds = Math.max(MIN_SLIDE, probeDuration(introVoice) + PAD_AFTER_VOICE);
  await titleFrame(clip.title, clip.subtitle, tmp("00.png"));
  frames.push({ file: tmp("00.png"), voice: introVoice, seconds: introSeconds });
  console.log(`  заставка: ${introSeconds.toFixed(1)} с озвучки`);

  for (const [i, item] of clip.items.entries()) {
    const file = tmp(`${String(i + 1).padStart(2, "0")}.png`);
    const voice = await synthesizeVoice(item.voice);
    const seconds = Math.max(MIN_SLIDE, probeDuration(voice) + PAD_AFTER_VOICE);
    await itemFrame(item, i + 1, file);
    frames.push({ file, voice, seconds });
    console.log(`  кадр ${i + 1}: ${item.name} — ${seconds.toFixed(1)} с`);
  }

  const inputs = [];
  const videoParts = [];
  const audioParts = [];

  frames.forEach((frame, i) => {
    // Каждый кадр — свой видеопоток постоянной длины, без зацикленного
    // наезда: раньше здесь стоял zoompan, его больше нет и не будет.
    // -framerate напрямую на зацикленную картинку даёт ровно нужное число
    // кадров без лишней арифметики.
    inputs.push("-framerate", "30", "-loop", "1", "-t", String(frame.seconds), "-i", frame.file);
    videoParts.push(`[${i * 2}:v]format=yuv420p,setsar=1[v${i}]`);

    // Голос короче слайда — хвост досюда домолчит паузой: apad растягивает
    // тишиной ровно до длины кадра, иначе звук и видео разъедутся уже на
    // второй карточке.
    inputs.push("-i", frame.voice);
    audioParts.push(`[${i * 2 + 1}:a]apad=whole_dur=${frame.seconds}[a${i}]`);
  });

  // Перекрёстное растворение между соседними карточками, цепочкой: каждый
  // следующий xfade берёт на вход уже смонтированный кусок, а не исходный
  // кадр. Смещение — это точка в объединённой до сих пор длине, где должен
  // начаться переход к следующей карточке: конец текущего отрезка минус
  // длина самого перехода. Звук идёт той же цепочкой через acrossfade —
  // звуковой аналог xfade, — с той же длительностью перехода, чтобы голос
  // не разошёлся с картинкой ни на кадр.
  let videoLabel = "v0";
  let audioLabel = "a0";
  let cursor = frames[0].seconds;

  for (let i = 1; i < frames.length; i++) {
    const nextVideo = `vx${i}`;
    const nextAudio = `ax${i}`;
    const offset = (cursor - CROSS).toFixed(3);

    videoParts.push(`[${videoLabel}][v${i}]xfade=transition=fade:duration=${CROSS}:offset=${offset}[${nextVideo}]`);
    audioParts.push(`[${audioLabel}][a${i}]acrossfade=d=${CROSS}:c1=tri:c2=tri[${nextAudio}]`);

    cursor = cursor + frames[i].seconds - CROSS;
    videoLabel = nextVideo;
    audioLabel = nextAudio;
  }

  const filterFile = tmp("filter.txt");
  writeFileSync(filterFile, [...videoParts, ...audioParts].join(";"));

  const out = dir(`out/${clip.out}.mp4`);

  execFileSync(
    FFMPEG,
    [
      "-y", ...inputs,
      "-/filter_complex", filterFile,
      "-map", `[${videoLabel}]`,
      "-map", `[${audioLabel}]`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
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

console.log(
  "Готово со звуком. Трек поверх в редакторе ВК накладывать не нужно — голос\n" +
    "уже есть; если хочется фоновой подложки, берите что-то тихое и явно\n" +
    "позади речи, а не трек на передний план.",
);
