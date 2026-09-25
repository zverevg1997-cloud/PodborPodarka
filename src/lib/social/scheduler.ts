/**
 * Публикация запланированных постов.
 *
 * Работает так: раз в минуту смотрим, не подошло ли время у одобренных
 * постов, и публикуем их в обе сети. Ничего не публикуется без одобрения —
 * это намеренно. Один нелепый пост в ленте стоит дороже, чем сэкономленные
 * пять минут на просмотр.
 *
 * Замок тот же по смыслу, что у слушателя телеграма: при выкатке контейнеры
 * какое-то время живут парой, и без него оба опубликуют один и тот же пост.
 */

import { prisma } from "@/lib/prisma";
import { holdLock, releaseLock } from "@/lib/systemLock";
import { getFileBytes, sendMessage, sendPhoto } from "@/lib/telegram/api";
import { isVkConfigured, postToWall } from "@/lib/social/vk";

const LOCK = "social-scheduler";

/** Как часто смотрим на очередь. Минуты достаточно: посты не срочные. */
const TICK_MS = 60_000;

/** Ограничение телеграма на подпись к картинке. */
const CAPTION_LIMIT = 1024;

let running = false;

function channel(): string | null {
  return process.env.TELEGRAM_CHANNEL ?? null;
}

function admin(): string | null {
  return process.env.TELEGRAM_ADMIN_ID ?? null;
}

/** Сообщение администратору. Молчать о сбое хуже, чем разбудить. */
async function tellAdmin(text: string): Promise<void> {
  const to = admin();
  if (!to) return;
  await sendMessage(to, text).catch(() => {});
}

async function publishToTelegram(
  text: string,
  photoFileId: string | null,
): Promise<string | null> {
  const to = channel();
  if (!to) throw new Error("TELEGRAM_CHANNEL не задан");

  // С картинкой пост выглядит иначе и занимает в ленте больше места, но
  // подпись к ней ограничена. Длинный текст отправляем отдельно, чтобы он
  // не обрезался молча.
  if (photoFileId && text.length <= CAPTION_LIMIT) {
    const sent = (await sendPhoto(to, photoFileId, text)) as {
      result?: { message_id?: number };
    } | null;
    if (!sent?.result?.message_id) throw new Error("телеграм не принял пост с картинкой");
    return String(sent.result.message_id);
  }

  if (photoFileId) {
    await sendPhoto(to, photoFileId, "");
  }

  const sent = (await sendMessage(to, text)) as {
    result?: { message_id?: number };
  } | null;
  if (!sent?.result?.message_id) throw new Error("телеграм не принял пост");
  return String(sent.result.message_id);
}

/** Один пост: публикуем туда, куда он назначен, и записываем результат. */
async function publish(post: {
  id: string;
  key: string;
  networks: string;
  textVk: string;
  textTg: string;
  photoFileId: string | null;
}): Promise<void> {
  const toVk = post.networks === "both" || post.networks === "vk";
  const toTg = post.networks === "both" || post.networks === "tg";

  // Картинку скачиваем один раз: она нужна ВКонтакте в виде байтов, а
  // телеграму хватает его собственного идентификатора файла.
  const image =
    toVk && post.photoFileId ? await getFileBytes(post.photoFileId) : null;

  if (toVk && post.photoFileId && !image) {
    throw new Error("картинка не скачалась из телеграма");
  }

  let vkPostId: string | null = null;
  let tgMessageId: string | null = null;

  // Телеграм первым: он надёжнее, и если упадёт ВКонтакте, пост хотя бы
  // выйдет в канале, а не потеряется целиком.
  if (toTg) {
    tgMessageId = await publishToTelegram(post.textTg, post.photoFileId);
  }

  if (toVk) {
    if (!isVkConfigured()) throw new Error("VK_TOKEN или VK_GROUP_ID не заданы");
    vkPostId = await postToWall(post.textVk, image);
  }

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: {
      status: "published",
      publishedAt: new Date(),
      vkPostId,
      tgMessageId,
      error: null,
    },
  });

  const where = [
    vkPostId ? `вк: vk.com/wall-${process.env.VK_GROUP_ID}_${vkPostId}` : null,
    tgMessageId ? "телеграм: опубликован" : null,
  ]
    .filter(Boolean)
    .join("\n");

  await tellAdmin(`Опубликован пост ${post.key}\n${where}`);
}

/** Один проход по очереди. */
async function tick(): Promise<void> {
  const due = await prisma.scheduledPost.findMany({
    where: { status: "approved", publishAt: { lte: new Date() } },
    orderBy: { publishAt: "asc" },
    take: 5,
  });

  for (const post of due) {
    // Опросы и видео публикуются руками: в каждой сети у них свой формат,
    // и автоматизировать это ради нескольких записей не стоит.
    if (post.kind !== "post") {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "manual" },
      });
      await tellAdmin(
        `Пора публиковать руками (${post.kind === "poll" ? "опрос" : "видео"}), ключ ${post.key}:\n\n${post.textTg}`,
      );
      continue;
    }

    if (post.needsPhoto && !post.photoFileId) {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", error: "нет фотографии товара" },
      });
      await tellAdmin(
        `Пост ${post.key} не вышел: нужна фотография товара. Пришлите её мне с подписью ${post.key}, и я опубликую.`,
      );
      continue;
    }

    try {
      await publish(post);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 400);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", error: message },
      });
      await tellAdmin(`Пост ${post.key} не опубликовался:\n${message}`);
    }
  }
}

export async function startScheduler(): Promise<void> {
  if (running) return;
  running = true;

  while (!(await holdLock(LOCK))) {
    await new Promise((r) => setTimeout(r, 30_000));
  }

  const release = () => {
    void releaseLock(LOCK);
  };
  process.once("SIGTERM", release);
  process.once("SIGINT", release);

  console.log("посты: слежу за расписанием");

  for (;;) {
    try {
      if (!(await holdLock(LOCK))) {
        console.log("посты: замок потерян, расписание ведёт другой процесс");
        running = false;
        return;
      }

      await tick();
    } catch (error) {
      console.error("посты: проход не удался", error);
    }

    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}
