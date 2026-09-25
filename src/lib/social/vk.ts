/**
 * Публикация в сообщество ВКонтакте.
 *
 * Токенов у ВКонтакте три, и они не взаимозаменяемы:
 *
 * - сервисный ключ приложения читает чужие стены, но писать не умеет;
 * - токен сообщества пишет на стену, но не умеет загружать фотографии:
 *   `photos.getWallUploadServer` отвечает ошибкой 27 «method is unavailable
 *   with group auth»;
 * - токен пользователя-администратора умеет и то, и другое.
 *
 * Поэтому в VK_TOKEN должен лежать именно пользовательский токен с правами
 * photos, wall, groups и offline. С токеном сообщества посты выходят, но
 * только текстом, и это выясняется в момент публикации, а не при настройке.
 */

const API = "https://api.vk.com/method";
const VERSION = "5.199";

function groupId(): string | null {
  return process.env.VK_GROUP_ID ?? null;
}

export function isVkConfigured(): boolean {
  return Boolean(process.env.VK_TOKEN && groupId());
}

/**
 * Вызов метода. ВКонтакте отвечает кодом 200 даже на ошибку, поэтому
 * смотрим не статус, а поле `error` в теле.
 */
async function call(
  method: string,
  params: Record<string, string>,
): Promise<unknown> {
  const token = process.env.VK_TOKEN;
  if (!token) throw new Error("VK_TOKEN не задан");

  const body = new URLSearchParams({
    ...params,
    access_token: token,
    v: VERSION,
  });

  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await res.json()) as {
    response?: unknown;
    error?: { error_code?: number; error_msg?: string };
  };

  if (data.error) {
    throw new Error(
      `vk ${method}: ${data.error.error_msg ?? "неизвестная ошибка"} (${data.error.error_code})`,
    );
  }

  return data.response;
}

/**
 * Загружает картинку на стену и возвращает её в виде вложения.
 *
 * Тремя шагами, иначе ВКонтакте не умеет: спросить адрес для загрузки,
 * отправить туда файл, подтвердить сохранение. Промежуточные ответы нигде
 * не хранятся и живут считаные минуты.
 */
async function uploadPhoto(image: Buffer): Promise<string> {
  const group = groupId();
  if (!group) throw new Error("VK_GROUP_ID не задан");

  const server = (await call("photos.getWallUploadServer", {
    group_id: group,
  })) as { upload_url?: string };

  if (!server?.upload_url) throw new Error("vk: адрес для загрузки не пришёл");

  const form = new FormData();
  // Имя поля и расширение важны: без них загрузчик отвечает отказом.
  form.append("photo", new Blob([new Uint8Array(image)]), "photo.jpg");

  const uploaded = await fetch(server.upload_url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  const result = (await uploaded.json()) as {
    server?: number;
    photo?: string;
    hash?: string;
  };

  if (!result?.photo) throw new Error("vk: загрузчик не вернул картинку");

  const saved = (await call("photos.saveWallPhoto", {
    group_id: group,
    server: String(result.server),
    photo: result.photo,
    hash: String(result.hash),
  })) as Array<{ owner_id: number; id: number }>;

  const photo = saved?.[0];
  if (!photo) throw new Error("vk: картинка не сохранилась");

  return `photo${photo.owner_id}_${photo.id}`;
}

/**
 * Публикует запись от имени сообщества.
 *
 * Возвращает идентификатор записи — по нему потом можно собрать ссылку и
 * посмотреть статистику.
 */
export async function postToWall(
  text: string,
  image?: Buffer | null,
): Promise<string> {
  const group = groupId();
  if (!group) throw new Error("VK_GROUP_ID не задан");

  const attachment = image ? await uploadPhoto(image) : null;

  const response = (await call("wall.post", {
    // Стена сообщества — это отрицательный идентификатор владельца.
    owner_id: `-${group}`,
    // Иначе запись выйдет от имени администратора, а не сообщества.
    from_group: "1",
    message: text,
    ...(attachment ? { attachments: attachment } : {}),
  })) as { post_id?: number };

  if (!response?.post_id) throw new Error("vk: запись не создалась");

  return String(response.post_id);
}
