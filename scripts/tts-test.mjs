// Проверка: доступна ли озвучка через Yandex SpeechKit на уже имеющемся
// ключе, или под неё нужна отдельная роль в консоли облака.
//
// Ключ и каталог те же, что для YandexART и YandexGPT (YANDEX_API_KEY,
// YANDEX_FOLDER_ID) — в одном сервисном аккаунте Яндекс.Облака можно
// включить несколько сервисов, но у каждого своя роль. Генерацию картинок
// в своё время запускала роль ai.imageGeneration.user, выданная отдельно;
// SpeechKit, скорее всего, так же потребует свою.
//
// Запуск: node scripts/tts-test.mjs   (с ВЫКЛЮЧЕННЫМ VPN)

import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url).pathname.slice(1), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const KEY = env.YANDEX_API_KEY;
const FOLDER = env.YANDEX_FOLDER_ID;

if (!KEY || !FOLDER) {
  console.log("В .env нет YANDEX_API_KEY или YANDEX_FOLDER_ID.");
  process.exit(1);
}

const res = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
  method: "POST",
  headers: {
    Authorization: `Api-Key ${KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    text: "Проверка синтеза речи для видео Дарибота.",
    lang: "ru-RU",
    // alena — нейтральный женский голос по умолчанию. Если доступ есть,
    // голос для роликов подберём отдельно — их у SpeechKit несколько.
    voice: "alena",
    folderId: FOLDER,
    format: "mp3",
  }),
  signal: AbortSignal.timeout(30_000),
});

console.log(`ответ: ${res.status}`);

if (!res.ok) {
  const text = await res.text();
  console.log(text.slice(0, 500));

  if (res.status === 403 || res.status === 401) {
    console.log(
      "\nПохоже, роли на SpeechKit у сервисного аккаунта нет. В консоли " +
        "Яндекс.Облака: IAM → сервисный аккаунт → добавить роль " +
        "ai.speechkit-tts.user (или ai.editor, если нужна одна роль на всё).",
    );
  }
  process.exit(0);
}

const bytes = Buffer.from(await res.arrayBuffer());
writeFileSync(new URL("../scripts/tts-test.mp3", import.meta.url), bytes);
console.log(`озвучка получена: ${bytes.length} байт, сохранено в scripts/tts-test.mp3`);
