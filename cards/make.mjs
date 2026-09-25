// Карточки к постам-рассуждениям.
//
// У таких постов нет товара, а значит нет и фотографии. Выкладывать их
// голым текстом нельзя: в ленте ВК запись без картинки почти не
// показывается, а в Телеграме её пролистывают.
//
// Поэтому карточка не иллюстрация к тезису, а сам тезис, набранный крупно
// поверх подходящего снимка. Человек читает его, не открывая пост, и через
// пару недель узнаёт наши карточки в ленте.
//
// Фоны рисует cards/art.mjs — если фон есть, текст ложится на него, и снизу
// добавляется затемнение, иначе белые буквы теряются на светлых местах
// снимка. Если фона нет, карточка выходит кремовой: это запасной вариант,
// а не отдельный стиль.
//
// Готовая карточка называется по ключу своего поста, а не по своему
// номеру: бот узнаёт пост именно по ключу в подписи, и так файл достаточно
// переслать ему, не сверяясь ни с какой таблицей.
//
// Запуск: node cards/make.mjs  →  cards/out/<ключ поста>.png

import { existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const SIZE = 1200;
const MARGIN = 96;
const WIDTH = SIZE - MARGIN * 2;

// Цвета взяты из src/app/icon.svg и globals.css, чтобы карточки и сайт
// выглядели одним целым.
const CREAM = "#fff8f3";
const INK = "#2b1b3d";
const PINK = "#ff5c7a";
const VIOLET = "#7c5cfc";
const GOLD = "#ffb020";

const CARDS = [
  {
    id: "01-tri-voprosa",
    post: "2026-09-25-three-questions",
    tag: "правило",
    text: "Три вопроса, которые заменяют любую подборку",
    note: "Чем занимается по своей воле · Что у него ломается · Что откладывает на потом",
  },
  {
    id: "02-svechi",
    post: "2026-09-26-candles",
    tag: "правило",
    text: "Свечи дарят все. Не зажигает никто",
    note: "Они подходят всем — то есть никому конкретно",
  },
  {
    id: "03-vyvedat",
    post: "2026-09-27-how-to-ask",
    tag: "правило",
    text: "«Что тебе подарить?» — вопрос, на который не отвечают",
    note: "Спросите, что ему подарили в прошлом году. И как, пригодилось",
  },
  {
    id: "04-upakovka",
    post: "2026-09-28-packaging",
    tag: "правило",
    text: "Вещь за 500 в хорошей упаковке дороже вещи за 1500 в пакете",
    note: "Отложите из бюджета двести рублей на коробку и ленту",
  },
  {
    id: "05-rashodnoe",
    post: "2026-09-30-consumable",
    tag: "правило",
    text: "Чем хуже знаете человека, тем расходнее должен быть подарок",
    note: "Малознакомому — то, что кончится. Близкому — то, что останется",
  },
  {
    id: "06-fraza",
    post: "2026-10-01-killer-phrase",
    tag: "правило",
    text: "«Я не знал, что тебе подарить»",
    note: "Фраза, которая обесценивает даже хороший подарок",
  },
  {
    id: "07-dva-podarka",
    post: "2026-10-02-two-gifts",
    tag: "правило",
    text: "Три подарка по тысяче хуже одного на три",
    note: "Если из них не складывается предложение «чтобы ты мог…» — берите один",
  },
  {
    id: "08-gorshok",
    post: "2026-10-03-pot-vs-bouquet",
    tag: "день учителя",
    text: "Букет живёт четыре дня. Растение в горшке — годы",
    note: "Стоят они одинаково",
  },
  {
    id: "09-otkrytka",
    post: "2026-10-04-postcard",
    tag: "день учителя",
    text: "«Спасибо за ваш труд» забудут через час",
    note: "Напишите одну конкретную вещь, которую человек изменил",
  },
  {
    id: "10-nedelya",
    post: "2026-09-29-week-left",
    tag: "день учителя",
    text: "Через неделю День учителя",
    note: "В родительских чатах уже начали собирать",
  },
  {
    id: "11-nelzya",
    post: "2026-09-29-teacher-dont",
    tag: "день учителя",
    text: "Дороже 3000 ₽ учителю дарить нельзя. По закону",
    note: "Статья 575 ГК РФ. И это на весь класс, а не с человека",
  },
  {
    id: "12-ot-klassa",
    post: "2026-10-01-from-class",
    tag: "день учителя",
    text: "Сто рублей сдают молча. Пятьсот — обсуждают три дня",
    note: "Как собрать деньги с класса и не поссориться",
  },
  {
    id: "13-neudachnyy",
    post: "2026-09-26-worst-gift",
    tag: "разговор",
    text: "Какой самый неудачный подарок вам дарили?",
    note: "Чаще всего дарят не вещь, а образ жизни, которого у человека нет",
  },
  {
    id: "14-itog",
    post: "2026-10-05-summary",
    tag: "разговор",
    text: "Дарить в пространство, а не в руки",
    note: "Чайник в кабинет живёт десять лет. Кружка — до первой уборки в шкафу",
  },
  {
    id: "15-prazdnik",
    post: "2026-10-05-teachers-day",
    tag: "день учителя",
    text: "С Днём учителя",
    note: "Результат виден через десять лет, а претензии приходят сегодня",
  },
];

/** В SVG нельзя отдавать сырые & < >, иначе разметка ломается молча. */
function esc(text) {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

/**
 * Перенос по словам. Ширину символа считаем приближённо: точных метрик у
 * нас нет, а для заголовка в три-четыре строки приближения достаточно —
 * ошибка в пару процентов не видна, потому что справа остаётся поле.
 */
function wrap(text, fontSize, maxWidth) {
  const perChar = fontSize * 0.53;
  const limit = Math.floor(maxWidth / perChar);
  const lines = [];
  let line = "";

  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Длинному тезису — кегль поменьше, чтобы он не уехал за край. */
function pickFontSize(text) {
  if (text.length <= 28) return 108;
  if (text.length <= 48) return 92;
  if (text.length <= 70) return 78;
  return 68;
}

function render({ tag, text, note }, onPhoto) {
  const ink = onPhoto ? "#ffffff" : INK;
  const accent = onPhoto ? "#ffffff" : VIOLET;

  const fontSize = pickFontSize(text);
  const lines = wrap(text, fontSize, WIDTH);
  const lineHeight = Math.round(fontSize * 1.22);
  const noteLines = note ? wrap(note, 34, WIDTH) : [];

  const blockHeight = lines.length * lineHeight;
  const noteHeight = noteLines.length * 46;

  // На фотографии текст прижимаем к низу: там затемнение, и туда же смотрит
  // глаз. На пустом фоне — по центру, иначе карточка выглядит перекошенной.
  const top = onPhoto
    ? SIZE - 230 - noteHeight - 50 - blockHeight
    : Math.round((SIZE - blockHeight) / 2) - 40;

  const heading = lines
    .map(
      (line, i) =>
        `<text x="${MARGIN}" y="${top + (i + 1) * lineHeight}" font-family="Segoe UI" font-size="${fontSize}" font-weight="700" fill="${ink}">${esc(line)}</text>`,
    )
    .join("\n  ");

  const noteBlock = noteLines
    .map(
      (line, i) =>
        `<text x="${MARGIN}" y="${top + blockHeight + 64 + i * 46}" font-family="Segoe UI" font-size="34" font-weight="400" fill="${ink}" opacity="${onPhoto ? 0.88 : 0.62}">${esc(line)}</text>`,
    )
    .join("\n  ");

  const backdrop = onPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="url(#scrim)"/>`
    : `<rect width="${SIZE}" height="${SIZE}" fill="${CREAM}"/>
  <circle cx="${SIZE - 120}" cy="180" r="420" fill="url(#glow)"/>
  <circle cx="60" cy="${SIZE - 80}" r="380" fill="url(#glow2)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${PINK}"/>
      <stop offset="1" stop-color="${VIOLET}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1a1225" stop-opacity="0.18"/>
      <stop offset="0.3" stop-color="#1a1225" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#1a1225" stop-opacity="0.93"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${VIOLET}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${PINK}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${PINK}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  ${backdrop}
  <rect width="${SIZE}" height="14" fill="url(#brand)"/>

  <rect x="${MARGIN}" y="140" width="${tag.length * 20 + 56}" height="58" rx="29" fill="${accent}" opacity="${onPhoto ? 0.22 : 0.1}"/>
  <text x="${MARGIN + 28}" y="178" font-family="Segoe UI" font-size="28" font-weight="600" fill="${accent}" letter-spacing="1.5">${esc(tag.toUpperCase())}</text>

  ${heading}
  ${noteBlock}

  <g transform="translate(${MARGIN}, ${SIZE - 150}) scale(0.95)">
    <rect width="64" height="64" rx="14" fill="url(#brand)"/>
    <circle cx="25" cy="17" r="6" fill="${GOLD}"/>
    <circle cx="39" cy="17" r="6" fill="${GOLD}"/>
    <rect x="12" y="20" width="40" height="12" rx="3" fill="#fff"/>
    <rect x="16" y="32" width="32" height="20" rx="3" fill="#fff"/>
    <rect x="28.5" y="20" width="7" height="32" fill="${GOLD}"/>
  </g>
  <text x="${MARGIN + 86}" y="${SIZE - 117}" font-family="Segoe UI" font-size="38" font-weight="700" fill="${ink}">Дарибот</text>
  <text x="${MARGIN + 86}" y="${SIZE - 80}" font-family="Segoe UI" font-size="27" font-weight="400" fill="${ink}" opacity="${onPhoto ? 0.75 : 0.5}">подбор подарков с ИИ · дарибот.рф</text>
</svg>`;
}

const dir = (name) => new URL(name, import.meta.url).pathname.slice(1);

mkdirSync(dir("out/"), { recursive: true });

for (const card of CARDS) {
  const bg = dir(`bg/${card.id}.jpg`);
  const onPhoto = existsSync(bg);
  const svg = Buffer.from(render(card, onPhoto));

  const base = onPhoto
    ? sharp(bg).resize(SIZE, SIZE, { fit: "cover" })
    : sharp({
        create: { width: SIZE, height: SIZE, channels: 4, background: CREAM },
      });

  await base
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toFile(dir(`out/${card.post}.png`));

  console.log(`${card.post}.png${onPhoto ? " — на фото" : ""}`);
}

console.log(`\nготово: ${CARDS.length} карточек в cards/out/`);
