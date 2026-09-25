/**
 * Управление расписанием постов из переписки с ботом.
 *
 * Отдельной админки нет намеренно: всё, что нужно делать с планом, —
 * посмотреть, одобрить и приложить фотографию. Для этого хватает бота, и
 * это можно сделать с телефона за минуту.
 */

import { prisma } from "@/lib/prisma";
import {
  answerCallback,
  sendMessage,
  type InlineKeyboard,
} from "@/lib/telegram/api";

export function isAdmin(chatId: string): boolean {
  const admin = process.env.TELEGRAM_ADMIN_ID;
  return Boolean(admin) && chatId === admin;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "черновик",
  approved: "одобрен",
  published: "опубликован",
  skipped: "отменён",
  failed: "не вышел",
  manual: "ждёт ручной публикации",
};

const MOSCOW = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function line(post: {
  key: string;
  publishAt: Date;
  status: string;
  kind: string;
  needsPhoto: boolean;
  photoFileId: string | null;
  error: string | null;
}): string {
  const marks: string[] = [STATUS_LABEL[post.status] ?? post.status];
  if (post.kind !== "post") marks.push(post.kind === "poll" ? "опрос" : "видео");
  if (post.needsPhoto && !post.photoFileId) marks.push("нужно фото");
  if (post.error) marks.push(post.error);

  return `${MOSCOW.format(post.publishAt)} · ${post.key}\n   ${marks.join(" · ")}`;
}

/** Ближайшая неделя плана — то, что помещается в одно сообщение. */
async function planText(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const week = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

  const posts = await prisma.scheduledPost.findMany({
    where: { publishAt: { lte: week } },
    orderBy: { publishAt: "asc" },
  });

  if (posts.length === 0) {
    return {
      text: "План пуст. Залейте его командой /seed.",
      keyboard: [],
    };
  }

  const drafts = posts.filter((p) => p.status === "draft").length;
  const needPhoto = posts.filter(
    (p) => p.needsPhoto && !p.photoFileId && p.status !== "published",
  );

  const parts = [
    `<b>План на неделю</b> — ${posts.length} записей, черновиков ${drafts}`,
    "",
    posts.map(line).join("\n"),
  ];

  if (needPhoto.length > 0) {
    parts.push(
      "",
      `Фотографии нужны для ${needPhoto.length} постов. Пришлите картинку и в подписи укажите ключ, например «${needPhoto[0].key}».`,
    );
  }

  const keyboard: InlineKeyboard = [];
  if (drafts > 0) {
    keyboard.push([
      { text: `Одобрить всё (${drafts})`, callback_data: "plan:approve" },
    ]);
  }
  keyboard.push([{ text: "Обновить", callback_data: "plan:refresh" }]);

  return { text: parts.join("\n"), keyboard };
}

/**
 * Команда администратора. Возвращает true, если разобралась сама, —
 * тогда обычный диалог подбора подарков не запускается.
 */
export async function handleAdminCommand(
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!isAdmin(chatId)) return false;

  const command = text.trim().toLowerCase();

  if (command === "/plan" || command === "/план") {
    const { text: body, keyboard } = await planText();
    await sendMessage(chatId, body, keyboard);
    return true;
  }

  if (command === "/seed") {
    await sendMessage(chatId, await seedPlan());
    const { text: body, keyboard } = await planText();
    await sendMessage(chatId, body, keyboard);
    return true;
  }

  if (command.startsWith("/mark ")) {
    // «В этой сети пост уже вышел». Нужна, когда запись ушла, а отметиться
    // не успела: до этой правки публикация в двух сетях могла отработать
    // наполовину и не сохранить удачную половину.
    const [, key, network] = text.trim().split(/s+/);
    const field =
      network === "tg" ? "tgMessageId" : network === "vk" ? "vkPostId" : null;

    if (!key || !field) {
      await sendMessage(chatId, "Нужно так: /mark <ключ> tg — или vk.");
      return true;
    }

    const updated = await prisma.scheduledPost.updateMany({
      where: { key },
      data: { [field]: "вручную" },
    });
    await sendMessage(
      chatId,
      updated.count > 0
        ? `Отметил: ${key} уже вышел в ${network === "tg" ? "телеграме" : "вк"}. Повтор туда больше не пойдёт.`
        : `Не нашёл пост ${key}.`,
    );
    return true;
  }

  if (command.startsWith("/retry ")) {
    const key = text.trim().slice(7).trim();
    // Возвращаем в очередь только упавшие: «повторить» для опубликованного
    // означало бы выпустить его вторым разом.
    const updated = await prisma.scheduledPost.updateMany({
      where: { key, status: { in: ["failed", "manual", "skipped"] } },
      data: { status: "approved", error: null },
    });
    await sendMessage(
      chatId,
      updated.count > 0
        ? `Пост ${key} вернулся в очередь. Если его время уже прошло, выйдет в ближайшую минуту.`
        : `Не нашёл упавший пост ${key}. Список — в /plan.`,
    );
    return true;
  }

  if (command.startsWith("/skip ")) {
    const key = text.trim().slice(6).trim();
    const updated = await prisma.scheduledPost.updateMany({
      where: { key, status: { in: ["draft", "approved", "failed", "manual"] } },
      data: { status: "skipped" },
    });
    await sendMessage(
      chatId,
      updated.count > 0 ? `Пост ${key} отменён.` : `Не нашёл пост ${key}.`,
    );
    return true;
  }

  return false;
}

/**
 * Фотография от администратора. Ключ поста берём из подписи: иначе
 * непонятно, к какому из шестнадцати постов она относится.
 */
export async function handleAdminPhoto(
  chatId: string,
  fileId: string,
  caption: string | undefined,
): Promise<boolean> {
  if (!isAdmin(chatId)) return false;

  const key = caption?.trim();
  if (!key) {
    await sendMessage(
      chatId,
      "Не понял, к какому посту картинка. Пришлите её ещё раз и напишите в подписи ключ поста — их список в /plan.",
    );
    return true;
  }

  const post = await prisma.scheduledPost.findUnique({ where: { key } });
  if (!post) {
    await sendMessage(chatId, `Не нашёл пост ${key}. Список — в /plan.`);
    return true;
  }

  if (post.status === "published") {
    await sendMessage(chatId, `Пост ${key} уже опубликован, картинку не меняю.`);
    return true;
  }

  // Пост, который не вышел из-за отсутствия картинки, сразу возвращаем в
  // очередь: время у него уже прошло, и он уйдёт на ближайшем проходе.
  const status =
    post.status === "failed" && post.error?.includes("фотограф")
      ? "approved"
      : post.status;

  await prisma.scheduledPost.update({
    where: { key },
    data: { photoFileId: fileId, status, error: null },
  });

  await sendMessage(
    chatId,
    status === "approved" && post.status === "failed"
      ? `Картинка принята. Пост ${key} опубликуется в ближайшую минуту.`
      : `Картинка принята для ${key}.`,
  );
  return true;
}

/** Нажатие на кнопку под планом. */
export async function handleAdminCallback(
  chatId: string,
  data: string,
  callbackId: string,
): Promise<boolean> {
  if (!isAdmin(chatId) || !data.startsWith("plan:")) return false;

  if (data === "plan:approve") {
    const updated = await prisma.scheduledPost.updateMany({
      where: { status: "draft" },
      data: { status: "approved" },
    });
    await answerCallback(callbackId, `Одобрено: ${updated.count}`);
    const { text, keyboard } = await planText();
    await sendMessage(chatId, text, keyboard);
    return true;
  }

  if (data === "plan:refresh") {
    await answerCallback(callbackId);
    const { text, keyboard } = await planText();
    await sendMessage(chatId, text, keyboard);
    return true;
  }

  return false;
}

/**
 * Заливает план из кода в базу.
 *
 * Отдельным скриптом это делать неудобно: база живёт на сервере, а скрипту
 * пришлось бы тащить с собой сборку TypeScript. Команда бота выполняется
 * там же, где приложение, и ей доступно всё то же самое.
 *
 * Повторный вызов безопасен: тексты обновятся, а одобрение, картинки и
 * отметки о публикации останутся. Опубликованное не трогаем вовсе.
 */
export async function seedPlan(): Promise<string> {
  const { PLAN, moscowTime } = await import("@/lib/social/plan");

  let added = 0;
  let updated = 0;
  let untouched = 0;

  for (const item of PLAN) {
    const existing = await prisma.scheduledPost.findUnique({
      where: { key: item.key },
    });

    if (existing?.status === "published") {
      untouched++;
      continue;
    }

    const data = {
      publishAt: moscowTime(item.when),
      kind: item.kind ?? "post",
      networks: item.networks ?? "both",
      textVk: item.textVk,
      textTg: item.textTg,
      needsPhoto: item.needsPhoto ?? false,
    };

    if (existing) {
      await prisma.scheduledPost.update({ where: { key: item.key }, data });
      updated++;
    } else {
      await prisma.scheduledPost.create({ data: { key: item.key, ...data } });
      added++;
    }
  }

  return `План залит: новых ${added}, обновлено ${updated}, пропущено как опубликованные ${untouched}.`;
}
