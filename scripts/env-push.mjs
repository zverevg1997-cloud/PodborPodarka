// Отправить одну переменную окружения на боевой сервер.
//
// Почему именно одну. У Timeweb нет отдельного адреса для переменных: их
// меняют вместе со всем приложением, передавая полный набор `envs`. Кто
// отправит набор не целиком — затрёт остальное. Один раз мы так уже
// подменили боевой VK_TOKEN двадцатью случайными символами.
//
// Поэтому порядок такой: читаем то, что стоит на сервере сейчас, подставляем
// одно названное значение и отправляем обратно. Значение берём из .env и
// никогда из командной строки — она оседает в истории оболочки и видна в
// списке процессов.
//
// Запуск: node scripts/env-push.mjs TAKPRODAM_API_KEY

import { readFileSync } from "node:fs";

const APP = "258605";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url).pathname.slice(1), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const name = process.argv[2];
if (!name) {
  console.log("Укажите имя переменной: node scripts/env-push.mjs TAKPRODAM_API_KEY");
  process.exit(1);
}

const value = env[name];
if (!value) {
  console.log(`В .env нет ${name}.`);
  process.exit(1);
}

const TOKEN = env.TIMEWEB_TOKEN;
if (!TOKEN) {
  console.log("В .env нет TIMEWEB_TOKEN.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const read = await fetch(`https://api.timeweb.cloud/api/v1/apps/${APP}`, { headers });
if (!read.ok) {
  console.log(`Не прочитал приложение: ${read.status}`);
  process.exit(1);
}

const { app } = await read.json();
const envs = { ...app.envs };

if (envs[name] === value) {
  console.log(`${name} на сервере уже такой же. Ничего не меняю.`);
  process.exit(0);
}

const was = name in envs ? "меняю" : "добавляю";
envs[name] = value;

const write = await fetch(`https://api.timeweb.cloud/api/v1/apps/${APP}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ envs }),
});

if (!write.ok) {
  console.log(`Не записал: ${write.status} ${(await write.text()).slice(0, 200)}`);
  process.exit(1);
}

// Длину показать можно, само значение — нет.
console.log(`${was} ${name} (${value.length} символов). Переменных всего: ${Object.keys(envs).length}.`);
console.log("Сервер перезапустится сам, это минута-две.");
