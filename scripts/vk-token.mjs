// Получение токена ВКонтакте с правами на публикацию.
//
// Зачем: токен сообщества не умеет загружать фотографии — photos.* отвечает
// ошибкой 27 «method is unavailable with group auth». Нужен токен
// пользователя-администратора с правом photos.
//
// Почему не через VK ID. Новый вход ВК решает другую задачу — вход на сайт,
// — и права выдаёт только на передачу данных о человеке: имя, почту. Мы это
// проверили: согласие так и называлось, «передача данных для входа», а
// полученный токен отвечал на photos.getWallUploadServer ошибкой 15/1133
// «cannot be called with current scopes». Классические права API там взять
// негде, поэтому здесь старый способ авторизации — он их выдаёт.
//
// Неявную выдачу — когда токен приходит прямо в адресе — ВК у этого
// приложения тоже закрыл: отвечает «Security Error». Поэтому здесь
// остаток старого способа, который ещё работает: сначала одноразовый код,
// потом обмен его на токен с предъявлением секрета приложения.
//
// У старого способа есть приятное следствие: с правом offline токен
// бессрочный, и продлевать его не нужно.
//
//
// Запуск:  node scripts/vk-token.mjs <ID приложения> [адрес возврата] [права]

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const APP_ID = process.argv[2];
const REDIRECT = process.argv[3] ?? "https://xn--80achr5ajr.xn--p1ai/vk-callback";
const SCOPE = process.argv[4] ?? "photos,wall,groups,offline";
const ENV = new URL("../.env", import.meta.url).pathname.slice(1);

if (!APP_ID || !/^\d+$/.test(APP_ID)) {
  console.log("Укажите ID приложения: node scripts/vk-token.mjs 54790289");
  console.log("Это число со страницы приложения, не идентификатор сообщества.");
  process.exit(1);
}

const authorize =
  "https://oauth.vk.com/authorize?" +
  new URLSearchParams({
    client_id: APP_ID,
    display: "page",
    redirect_uri: REDIRECT,
    scope: SCOPE,
    response_type: "code",
    v: "5.199",
    // Иначе ВК пускает молча по прежнему разрешению и новых прав не даёт.
    revoke: "1",
  });

console.log(`\nПрава: ${SCOPE}`);
console.log(`Адрес возврата: ${REDIRECT}`);
console.log("Он должен быть прописан в настройках приложения,");
console.log("в «Доверенные redirect URI».\n");
console.log("1. Откройте ссылку в браузере, где вы вошли как");
console.log("   администратор сообщества:\n");
console.log(authorize);
console.log("\n2. В списке прав должны быть фотографии, стена и сообщества.");
console.log("   Если их нет — не разрешайте, скажите мне, что там.");
console.log("3. Разрешите доступ, на вернувшейся странице нажмите");
console.log("   «Скопировать адрес» и вставьте сюда.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question("Адрес: ")).trim();
rl.close();

let returned;
try {
  const url = new URL(answer);
  returned = new URLSearchParams(
    url.search.length > 1 ? url.search.slice(1) : url.hash.slice(1),
  );
} catch {
  console.log("\nЭто не похоже на адрес. Нужен он целиком, вместе с https://");
  process.exit(1);
}

if (returned.get("error")) {
  console.log(`\nВК отказал: ${returned.get("error")}`);
  console.log(returned.get("error_description") ?? "");
  process.exit(1);
}

const code = returned.get("code");

if (!code) {
  console.log("\nВ адресе нет кода. Возможно, скопировалась не та страница");
  console.log("или доступ не был разрешён.");
  process.exit(1);
}

// Секрет приложения берём из .env, чтобы он не мелькал в командной строке:
// её содержимое попадает в историю оболочки и видно в списке процессов.
const secret = (readFileSync(ENV, "utf8").match(/^VK_APP_SECRET="?([^"\r\n]+)/m) ?? [])[1];

if (!secret) {
  console.log("\nВ .env нет VK_APP_SECRET — без него код не обменять.");
  process.exit(1);
}

const exchanged = await fetch(
  "https://oauth.vk.com/access_token?" +
    new URLSearchParams({
      client_id: APP_ID,
      client_secret: secret,
      redirect_uri: REDIRECT,
      code,
    }),
).then((res) => res.json());

const token = exchanged.access_token;

if (!token) {
  console.log("\nОбмен кода на токен не удался:");
  console.log(JSON.stringify(exchanged).slice(0, 400));
  process.exit(1);
}

const call = async (method, params = {}) => {
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: token, v: "5.199" }),
  });
  return res.json();
};

const me = await call("users.get");
const owner = me?.response?.[0];
console.log(
  owner
    ? `\nТокен принадлежит: ${owner.first_name} ${owner.last_name} (id ${owner.id})`
    : "\nВнимание: у токена нет владельца-человека — похоже, он от сообщества.",
);

// Главная проверка. Без неё мы узнали бы об отсутствии прав только в момент
// публикации, то есть в девять вечера и без возможности что-то сделать.
const group = (readFileSync(ENV, "utf8").match(/^VK_GROUP_ID="?(\d+)/m) ?? [])[1];
let uploads = false;

if (group) {
  const upload = await call("photos.getWallUploadServer", { group_id: group });
  uploads = Boolean(upload?.response?.upload_url);
  console.log(
    uploads
      ? "Загрузка фотографий: работает."
      : `Загрузка фотографий: НЕ работает — ${upload?.error?.error_msg ?? "неизвестно"}`,
  );
}

if (!uploads) {
  console.log("\nТокен не записан: без загрузки фотографий он не лучше прежнего.");
  process.exit(1);
}

let env = readFileSync(ENV, "utf8");
env = env.replace(/^VK_TOKEN=.*$/m, `VK_TOKEN="${token}"`);
// Старый способ выдаёт бессрочный токен, продлевать нечего. Оставшаяся от
// VK ID строка сбила бы приложение с толку — оно бы полезло продлеваться.
env = env.replace(/^VK_REFRESH_TOKEN=.*\n?/m, "");
writeFileSync(ENV, env);

console.log("\nТокен записан в .env. Срок жизни: бессрочный (право offline).");
console.log("Скажите — перенесу его на сервер.");
