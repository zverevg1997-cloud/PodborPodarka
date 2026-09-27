// Проверка токена ВКонтакте: чей он и что ему разрешено.
//
// Токен берётся из .env, а не из командной строки: всё, что набрано в
// терминале, оседает в истории оболочки и видно в списке процессов. В
// переписку его тем более слать не стоит.
//
// Положите проверяемый токен в .env строкой:
//   VK_TEST_TOKEN="vk1.a...."
//
// Запуск: node scripts/vk-check.mjs
//
// Можно проверить и любую другую переменную:
//   node scripts/vk-check.mjs VK_TOKEN

import { readFileSync } from "node:fs";

const NAME = process.argv[2] ?? "VK_TEST_TOKEN";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url).pathname.slice(1), "utf8")
    .split("\n")
    .map((line) => line.match(/^([A-Z_0-9]+)="?([^"\r\n]*)"?/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

// Адрес с хвостом вида &expires_in=... тоже принимаем: его удобнее
// скопировать целиком, чем выковыривать из него токен.
const token = (env[NAME] ?? "").split("&")[0].replace(/^.*access_token=/, "");

if (!token) {
  console.log(`В .env нет ${NAME}. Добавьте строкой: ${NAME}="vk1.a...."`);
  process.exit(1);
}

const group = env.VK_GROUP_ID ?? "";

const call = async (method, params = {}) => {
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: token, v: "5.199" }),
    signal: AbortSignal.timeout(20_000),
  });
  return res.json();
};

console.log(`Проверяю ${NAME} — ${token.length} символов\n`);

const me = await call("users.get");
const owner = me?.response?.[0];
console.log(
  owner
    ? `Владелец: ${owner.first_name} ${owner.last_name} (id ${owner.id})`
    : "Владельца нет — значит, это токен сообщества, а не человека.",
);

// Каждый метод упирается в своё право. По тому, какие прошли, видно набор.
const CHECKS = [
  ["стена", "wall.get", { owner_id: `-${group}`, count: "1" }],
  ["сообщества", "groups.get", { count: "1" }],
  ["фотографии на стену", "photos.getWallUploadServer", { group_id: group }],
  ["фотографии вообще", "photos.getAlbums", { owner_id: owner?.id ?? "" }],
  ["документы", "docs.getWallUploadServer", { group_id: group }],
  ["истории", "stories.getPhotoUploadServer", { add_to_news: "1" }],
];

console.log("");
let uploads = false;

for (const [label, method, params] of CHECKS) {
  const answer = await call(method, params);
  const ok = "response" in answer;
  if (method === "photos.getWallUploadServer" && ok) uploads = true;
  console.log(
    `  ${ok ? "да " : "нет"}  ${label.padEnd(22)}${ok ? "" : ` — ${answer.error?.error_msg?.slice(0, 60) ?? ""}`}`,
  );
}

console.log(
  uploads
    ? "\nГлавное: загрузка фотографий в группу РАБОТАЕТ. Скажите — перенесу токен на сервер."
    : "\nГлавное: загрузка фотографий в группу не работает. Этот токен нам не подходит.",
);
