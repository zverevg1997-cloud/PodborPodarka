/**
 * Покадровая сборка ролика: экран телефона, по которому «водит» человек.
 *
 * Не слайд-шоу из скриншотов, а имитация живого использования: нажатие на
 * кнопку с расходящимся кругом, переход между экранами сдвигом, постепенное
 * появление заполненных полей, вращающийся кружок на экране ожидания и
 * прокрутка результатов.
 *
 * Кадры пишутся в JPEG и кодируются посценно: полторы тысячи PNG заняли бы
 * полтора гигабайта на диске без всякой пользы.
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const W = 1080, H = 1920, FPS = 30;

/** Ширина, до которой масштабируем скриншот телефона (исходник 1284×2778). */
const SHOT_W = 900;
const SHOT_H = Math.round((SHOT_W * 2778) / 1284);
const SCALE = SHOT_W / 1284;

/** Окно, в котором видно экран. Короче самого экрана — отсюда прокрутка. */
const WIN_W = SHOT_W, WIN_H = 1560;
const WIN_X = Math.round((W - WIN_W) / 2), WIN_Y = 180;
const PAN_MAX = SHOT_H - WIN_H;

const DIR = "video/shots/";
const SHOTS = {
  hero: "image-25-09-26-12-07-16.png",
  form: "image-25-09-26-12-07-15.png",
  occasion: "image-25-09-26-12-07-13.png",
  loading: "image-25-09-26-12-07-11.png",
  results1: "image-25-09-26-12-07-9.png",
  results2: "image-25-09-26-12-07-7.png",
  results3: "image-25-09-26-12-07-5.png",
};

/** Координаты в системе исходного скриншота, 1284×2778. */
const TAPS = {
  hero: { x: 545, y: 1855 },
  occasion: { x: 658, y: 2228 },
};
const SPINNER = { x: 630, y: 1090, r: 78 };

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const scaled = {};
for (const [key, file] of Object.entries(SHOTS)) {
  scaled[key] = await sharp(DIR + file).resize(SHOT_W, SHOT_H).png().toBuffer();
}

const background = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ff5c7a"/>
        <stop offset="0.55" stop-color="#b95ab8"/>
        <stop offset="1" stop-color="#7c5cfc"/>
      </linearGradient>
      <filter id="soft" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="120"/>
      </filter>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#2b2430" flood-opacity="0.45"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="60" cy="1780" r="300" fill="#ffb020" opacity="0.2" filter="url(#soft)"/>
    <circle cx="1030" cy="180" r="260" fill="#ffffff" opacity="0.12" filter="url(#soft)"/>
    <rect x="${WIN_X}" y="${WIN_Y}" width="${WIN_W}" height="${WIN_H}" rx="46"
          fill="#2b2430" opacity="0.55" filter="url(#shadow)"/>
    <text x="${W / 2}" y="1835" font-family="Arial, Helvetica, sans-serif" font-size="40"
          font-weight="bold" text-anchor="middle" fill="#ffffff" opacity="0.92">дарибот.рф</text>
  </svg>`),
  { density: 72 },
)
  .resize(W, H, { fit: "fill" })
  .png()
  .toBuffer();

const windowMask = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIN_W}" height="${WIN_H}" viewBox="0 0 ${WIN_W} ${WIN_H}">
    <rect width="${WIN_W}" height="${WIN_H}" rx="46" fill="#fff"/></svg>`),
  { density: 72 },
)
  .resize(WIN_W, WIN_H, { fit: "fill" })
  .png()
  .toBuffer();

/**
 * Вырезает из экрана окно с прокруткой на pan пикселей и скругляет углы.
 * Сдвиг по горизонтали нужен только для перехода между экранами.
 */
async function windowOf(key, pan, shiftX = 0) {
  const top = Math.round(clamp(pan, 0, PAN_MAX));
  const slice = await sharp(scaled[key])
    .extract({ left: 0, top, width: WIN_W, height: WIN_H })
    .png()
    .toBuffer();

  if (shiftX === 0) {
    return sharp(slice).composite([{ input: windowMask, blend: "dest-in" }]).png().toBuffer();
  }

  // Сдвинутый экран: пустое место остаётся прозрачным, под ним виден фон.
  const shifted = await sharp({
    create: { width: WIN_W, height: WIN_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: slice, left: Math.round(shiftX), top: 0 }])
    .png()
    .toBuffer();

  return sharp(shifted).composite([{ input: windowMask, blend: "dest-in" }]).png().toBuffer();
}

/** Круг, расходящийся от точки нажатия, плюс сам «палец». */
function tapOverlay(tap, progress, pan) {
  const x = WIN_X + tap.x * SCALE;
  const y = WIN_Y + tap.y * SCALE - pan;
  if (y < WIN_Y - 40 || y > WIN_Y + WIN_H + 40) return null;

  const r = 30 + 150 * progress;
  const ringOpacity = 0.55 * (1 - progress);
  const dotOpacity = progress < 0.35 ? 0.5 : 0.5 * (1 - (progress - 0.35) / 0.65);

  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ffffff" stroke-width="7" opacity="${ringOpacity}"/>
          <circle cx="${x}" cy="${y}" r="46" fill="#ffffff" opacity="${dotOpacity}"/>`;
}

/** Вращающаяся дуга вокруг подарка на экране ожидания. */
function spinnerOverlay(angle, pan) {
  const x = WIN_X + SPINNER.x * SCALE;
  const y = WIN_Y + SPINNER.y * SCALE - pan;
  const r = SPINNER.r * SCALE;
  const circumference = 2 * Math.PI * r;

  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ffffff" stroke-width="9" opacity="0.28"/>
          <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ff5c7a" stroke-width="9"
                  stroke-linecap="round" stroke-dasharray="${circumference * 0.28} ${circumference}"
                  transform="rotate(${angle} ${x} ${y})"/>`;
}

/**
 * Шторка, открывающая заполненную анкету сверху вниз: выглядит так, будто
 * поля заполняют одно за другим. Ниже края — исходный экран приглушён.
 */
function fillCurtain(edgeY) {
  if (edgeY >= WIN_Y + WIN_H) return null;
  const top = Math.max(WIN_Y, edgeY);
  return `<rect x="${WIN_X}" y="${top}" width="${WIN_W}" height="${WIN_Y + WIN_H - top}"
                fill="#ffffff" opacity="0.72"/>
          <rect x="${WIN_X}" y="${edgeY - 4}" width="${WIN_W}" height="8"
                fill="#ff5c7a" opacity="0.5"/>`;
}

async function frame(layers) {
  const { key, pan = 0, shiftX = 0, overlay = "" } = layers;
  const win = await windowOf(key, pan, shiftX);

  const composite = [{ input: win, left: WIN_X, top: WIN_Y }];

  if (overlay) {
    const svg = await sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${overlay}</svg>`),
      { density: 72 },
    )
      .resize(W, H, { fit: "fill" })
      .png()
      .toBuffer();
    composite.push({ input: svg, left: 0, top: 0 });
  }

  return sharp(background).composite(composite).jpeg({ quality: 92 }).toBuffer();
}

const durations = readFileSync("video/build3/durations.txt", "utf8")
  .trim().split("\n").map(Number);

const TMP = "video/tmpframes";
const ONLY = process.argv[2] ? process.argv[2].split(",").map(Number) : null;
if (!ONLY && existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

/** Описание сцен: что показываем и что происходит по ходу реплики. */
const scenes = [
  { key: "hero", pan: () => PAN_MAX, tap: TAPS.hero, tapAt: [0.72, 0.95] },
  { key: "form", pan: () => 0, slideIn: true, curtain: [0.18, 0.95] },
  { key: "form", pan: (p) => PAN_MAX * ease(clamp((p - 0.1) / 0.85, 0, 1)) },
  { key: "occasion", pan: (p) => PAN_MAX * ease(clamp(p / 0.6, 0, 1)), slideIn: true, tap: TAPS.occasion, tapAt: [0.78, 0.98] },
  { key: "loading", pan: () => 0, slideIn: true, spinner: true },
  { key: "results1", pan: () => 0, slideIn: true },
  { key: "results1", pan: (p) => PAN_MAX * ease(clamp(p / 0.32, 0, 1)), scroll: true },
  { key: "finale" },
];

let sceneIndex = 0;
for (const scene of scenes) {
  if (ONLY && !ONLY.includes(sceneIndex)) { sceneIndex++; continue; }
  const duration = durations[sceneIndex];
  const total = Math.round(duration * FPS);
  const dir = `${TMP}/s${sceneIndex}`;
  mkdirSync(dir, { recursive: true });

  for (let f = 0; f < total; f++) {
    const p = total > 1 ? f / (total - 1) : 0;

    if (scene.key === "finale") {
      const zoom = 1 + 0.05 * ease(p);
      const w = Math.round(W * zoom), h = Math.round(H * zoom);
      const buf = await sharp("video/frames2/08.png")
        .resize(w, h)
        .extract({ left: Math.round((w - W) / 2), top: Math.round((h - H) / 2), width: W, height: H })
        .jpeg({ quality: 92 })
        .toBuffer();
      writeFileSync(`${dir}/${String(f).padStart(5, "0")}.jpg`, buf);
      continue;
    }

    let key = scene.key;
    let pan = scene.pan(p);
    let overlay = "";
    let shiftX = 0;

    // Переход: новый экран въезжает справа за первые полсекунды.
    if (scene.slideIn) {
      const slide = clamp((p * duration) / 0.5, 0, 1);
      shiftX = (1 - ease(slide)) * WIN_W;
    }

    // Прокрутка результатов: ближе к концу перескакиваем на следующие
    // скриншоты той же страницы — так видно, что список длинный.
    if (scene.scroll) {
      if (p > 0.66) key = "results3";
      else if (p > 0.33) key = "results2";
      pan = PAN_MAX * ease(clamp(((p % 0.33) / 0.33), 0, 1));
    }

    if (scene.tap) {
      const [from, to] = scene.tapAt;
      if (p >= from && p <= to) {
        const tp = (p - from) / (to - from);
        const ov = tapOverlay(scene.tap, tp, pan);
        if (ov) overlay += ov;
      }
    }

    if (scene.curtain) {
      const [from, to] = scene.curtain;
      const cp = clamp((p - from) / (to - from), 0, 1);
      const edge = WIN_Y + ease(cp) * WIN_H;
      const ov = fillCurtain(edge);
      if (ov) overlay += ov;
    }

    if (scene.spinner) {
      overlay += spinnerOverlay((p * duration * 300) % 360, pan);
    }

    const buf = await frame({ key, pan, shiftX, overlay });
    writeFileSync(`${dir}/${String(f).padStart(5, "0")}.jpg`, buf);
  }

  console.log(`сцена ${sceneIndex + 1}: ${total} кадров`);
  sceneIndex++;
}

writeFileSync(`${TMP}/done.txt`, "ok");
console.log("кадры готовы");
