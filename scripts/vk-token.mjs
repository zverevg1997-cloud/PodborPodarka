// Получение пользовательского токена ВКонтакте через VK ID.
//
// Зачем: токен сообщества не умеет загружать фотографии — photos.* отвечает
// ошибкой 27 «method is unavailable with group auth». Нужен токен
// пользователя-администратора, а старый простой способ его получить
// (response_type=token на oauth.vk.com) ВК закрыл.
//
// Новый вход устроен сложнее: сначала браузер отдаёт одноразовый код, потом
// код меняется на токен, и обмен подписывается секретом, который мы сами же
// придумали в начале. Руками это не делается, поэтому есть этот скрипт.
//
// Запуск:  node scripts/vk-token.mjs <ID приложения> [адрес возврата]
//
// Адрес возврата должен быть прописан в настройках приложения на dev.vk.com,
// в «Доверенные redirect URI». Служебный oauth.vk.com/blank.html из старого
// входа новый не принимает — страница просто не грузится, поэтому по
// умолчанию возвращаемся на свою.
//
// Токен нигде не печатается: скрипт сам кладёт его в .env.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const APP_ID = process.argv[2];
const REDIRECT = process.argv[3] ?? "https://xn--80achr5ajr.xn--p1ai/vk-callback";
const SCOPE = "photos wall groups offline";
const ENV = new URL("../.env", import.meta.url).pathname.slice(1);

if (!APP_ID || !/^\d+$/.test(APP_ID)) {
  console.log("Укажите ID приложения: node scripts/vk-token.mjs 51234567");
  console.log("Это число со страницы приложения на dev.vk.com,");
  console.log("не идентификатор сообщества и не часть токена.");
  process.exit(1);
}

const base64url = (buf) => buf.toString("base64url");

// Секрет придумываем здесь и никуда не отправляем до самого обмена. В браузер
// уходит только его отпечаток — так посторонний, перехвативший код, не сможет
// обменять его на токен.
const verifier = base64url(randomBytes(48));
const challenge = base64url(createHash("sha256").update(verifier).digest());
const state = base64url(randomBytes(12));

const authorize =
  "https://id.vk.com/authorize?" +
  new URLSearchParams({
    response_type: "code",
    client_id: APP_ID,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: REDIRECT,
    state,
    scope: SCOPE,
  });

console.log(`\nАдрес возврата: ${REDIRECT}`);
console.log("Он должен быть прописан в настройках приложения на dev.vk.com,");
console.log("в «Доверенные redirect URI» — иначе ВК покажет «Ошибка загрузки»");
console.log("вместо страницы входа.\n");
console.log("1. Откройте эту ссылку в браузере, где вы вошли как");
console.log("   администратор сообщества:\n");
console.log(authorize);
console.log("\n2. Разрешите доступ — вас вернёт на нашу страницу.");
console.log("3. Нажмите там «Скопировать адрес» и вставьте сюда.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question("Адрес: ")).trim();
rl.close();

let returned;
try {
  // Параметры приходят то в запросе, то за решёткой — принимаем оба вида.
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
const deviceId = returned.get("device_id");

if (!code) {
  console.log("\nВ адресе нет кода. Возможно, скопировалась не та страница.");
  process.exit(1);
}

// Проверяем, что вернулись именно с нашего запроса, а не с чужого.
if (returned.get("state") && returned.get("state") !== state) {
  console.log("\nОтвет пришёл не на наш запрос. Начните заново.");
  process.exit(1);
}

const exchange = await fetch("https://id.vk.com/oauth2/auth", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: APP_ID,
    redirect_uri: REDIRECT,
    ...(deviceId ? { device_id: deviceId } : {}),
    state,
  }),
});

const data = await exchange.json();

if (!data.access_token) {
  console.log(`\nОбмен не удался (${exchange.status}):`);
  console.log(JSON.stringify(data).slice(0, 400));
  process.exit(1);
}

// Проверяем, что токен действительно пользовательский и умеет то, ради чего
// всё затевалось. Иначе мы бы узнали об этом только в момент публикации.
const check = async (method, params = {}) => {
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      access_token: data.access_token,
      v: "5.199",
    }),
  });
  return res.json();
};

const me = await check("users.get");
const owner = me?.response?.[0];
console.log(
  owner
    ? `\nТокен принадлежит: ${owner.first_name} ${owner.last_name} (id ${owner.id})`
    : "\nВнимание: у токена нет владельца-человека. Похоже, он опять от сообщества.",
);

const group = (readFileSync(ENV, "utf8").match(/^VK_GROUP_ID="?(\d+)/m) ?? [])[1];
if (group) {
  const upload = await check("photos.getWallUploadServer", { group_id: group });
  console.log(
    upload?.response?.upload_url
      ? "Загрузка фотографий: работает."
      : `Загрузка фотографий: НЕ работает — ${upload?.error?.error_msg ?? "неизвестно"}`,
  );
}

// Пишем в .env, заменяя прежние значения или дописывая новые.
let env = readFileSync(ENV, "utf8");
const put = (name, value) => {
  const line = `${name}="${value}"`;
  env = new RegExp(`^${name}=.*$`, "m").test(env)
    ? env.replace(new RegExp(`^${name}=.*$`, "m"), line)
    : `${env.replace(/\s*$/, "")}\n${line}\n`;
};

put("VK_TOKEN", data.access_token);
if (data.refresh_token) put("VK_REFRESH_TOKEN", data.refresh_token);
writeFileSync(ENV, env);

console.log("\nТокен записан в .env.");
if (data.expires_in) {
  const hours = Math.round(data.expires_in / 3600);
  console.log(
    `Срок жизни: ${hours} ч. Значит, понадобится обновление по refresh_token —\n` +
      "скажите об этом, и я допишу его в приложение.",
  );
} else {
  console.log("Срок жизни: бессрочный.");
}
