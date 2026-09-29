/**
 * Публикация запланированных постов.
 *
 * Работает так: раз в минуту смотрим, не подошло ли время у одобренных
 * постов, и публикуем их в телеграм. Ничего не публикуется без одобрения —
 * это намеренно. Один нелепый пост в ленте стоит дороже, чем сэкономленные
 * пять минут на просмотр.
 *
 * Во ВКонтакте бот не публикует. Приложить фотографию он туда не может:
 * photos.getWallUploadServer отвечает ошибкой 27 на всех токенах, которые у
 * нас есть, а запись без картинки в ленте почти не показывается. Городить
 * ради этого текстовую публикацию бессмысленно — она уйдёт в пустоту.
 *
 * Поэтому за сутки бот отдаёт человеку готовый текст и картинку, а отложку
 * в сообществе человек ставит сам. Когда поставил — отмечает командой
 * /mark <ключ> vk, и пост уходит из очереди.
 *
 * Замок тот же по смыслу, что у слушателя телеграма: при выкатке контейнеры
 * какое-то время живут парой, и без него оба опубликуют один и тот же пост.
 */

import { prisma } from "@/lib/prisma";
import { holdLock, releaseLock } from "@/lib/systemLock";
import { sendMessage, sendPhoto } from "@/lib/telegram/api";

const LOCK = "social-scheduler";

/** Как часто смотрим на очередь. Минуты достаточно: посты не срочные. */
const TICK_MS = 60_000;

/** За сколько предупреждаем о посте: и о ВКонтакте, и о недостающей картинке. */
const WARN_AHEAD_MS = 24 * 60 * 60 * 1000;

/** Ограничение телеграма на подпись к картинке. */
const CAPTION_LIMIT = 1024;

/** Часы по Москве, когда смотрим чужие сообщества. */
const TREND_HOURS = [11, 20];

/** Как часто заглядываем, не устарели ли товарные выгрузки. */
const FEED_CHECK_MS = 30 * 60 * 1000;

let running = false;
let feedsCheckedAt = 0;

/**
 * Обновление выгрузок.
 *
 * Запускаем в стороне, не дожидаясь: разбор нескольких мегабайт занимает
 * минуты, а расписание постов ждать не может — пост, назначенный на это
 * время, вышел бы с опозданием.
 */
function refreshFeedsInBackground(): void {
  if (Date.now() - feedsCheckedAt < FEED_CHECK_MS) return;
  feedsCheckedAt = Date.now();

  void import("@/lib/products/import")
    .then(({ importDueFeeds }) => importDueFeeds())
    .then((results) => {
      for (const r of results) {
        console.log(
          r.error
            ? `выгрузка «${r.feed}»: ${r.error}`
            : `выгрузка «${r.feed}»: товаров ${r.saved}, пропало ${r.gone}`,
        );
      }
    })
    .catch((error) => console.error("выгрузки: обновить не вышло", error));
}

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

/**
 * Один пост: публикуем в телеграм и записываем результат.
 *
 * ВКонтакте здесь нет намеренно — он уходит человеку за сутки, см. шапку
 * файла и handOffVkPosts.
 */
async function publish(post: {
  id: string;
  key: string;
  networks: string;
  textVk: string;
  textTg: string;
  needsPhoto: boolean;
  photoFileId: string | null;
  vkPostId: string | null;
  tgMessageId: string | null;
}): Promise<void> {
  // Сеть, куда пост уже ушёл, пропускаем: без этой проверки повтор выложил
  // бы запись в канал ещё раз.
  const toTg =
    (post.networks === "both" || post.networks === "tg") && !post.tgMessageId;

  const tgMessageId = toTg
    ? await publishToTelegram(post.textTg, post.photoFileId)
    : post.tgMessageId;

  // Пост, назначенный только во ВКонтакте, бот не публиковал вовсе, и
  // «опубликован» тут было бы неправдой: его ставил человек, ещё сутки
  // назад. Такому ставим «вручную» — он уходит из очереди, но не
  // притворяется нашей работой.
  const published = tgMessageId !== null;

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: {
      status: published ? "published" : "manual",
      publishedAt: new Date(),
      tgMessageId,
      error: null,
    },
  });

  // Про ВКонтакте пишем, только если пост туда назначен и ещё не отмечен.
  // Напоминание с текстом ушло сутки назад, так что это короткая строка, а
  // не второй такой же разбор.
  const forVk =
    (post.networks === "both" || post.networks === "vk") && !post.vkPostId;

  const lines = [
    published ? `Опубликован пост ${post.key}` : `Время поста ${post.key}`,
    published ? "телеграм: вышел" : null,
    forVk ? `вк: за вами — когда поставите, отметьте /mark ${post.key} vk` : null,
  ].filter(Boolean);

  await tellAdmin(lines.join("\n"));
}

/**
 * Напоминание за сутки о постах без картинки.
 *
 * Раньше об этом можно было узнать только в момент, когда пост уже не вышел,
 * — то есть поздно. Суток хватает, чтобы подобрать товар и сфотографировать
 * его или собрать карточку.
 *
 * Предупреждаем одним сообщением на все такие посты и ровно один раз: то же
 * самое каждую минуту до публикации быстро научило бы не читать эти письма.
 */
async function warnAboutMissingPhotos(): Promise<void> {
  const soon = new Date(Date.now() + WARN_AHEAD_MS);

  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: { in: ["draft", "approved"] },
      // Опросы и видео публикуются руками, картинка им не нужна.
      kind: "post",
      // Только те, что идут в один телеграм: посты для ВКонтакте целиком
      // уходят человеку отдельным сообщением, и там про недостающую
      // картинку сказано в том же тексте. Два письма про один пост —
      // верный способ научить не читать оба.
      networks: "tg",
      photoFileId: null,
      warnedAt: null,
      publishAt: { lte: soon, gte: new Date() },
    },
    orderBy: { publishAt: "asc" },
  });

  if (posts.length === 0) return;

  const when = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = posts.map((post) => {
    // Разница существенная: один пост без картинки просто выйдет хуже,
    // а другой не выйдет вовсе, и это надо сказать разными словами.
    const consequence = post.needsPhoto
      ? "без неё не выйдет"
      : "выйдет текстом, в ВК это заметно срежет охват";
    return `${when.format(post.publishAt)} — ${post.key}\n   ${consequence}`;
  });

  await tellAdmin(
    `Через сутки выходят посты без картинки:\n\n${lines.join("\n")}\n\n` +
      "Пришлите картинку и укажите в подписи ключ поста.",
  );

  await prisma.scheduledPost.updateMany({
    where: { id: { in: posts.map((post) => post.id) } },
    data: { warnedAt: new Date() },
  });
}

/**
 * Передача постов для ВКонтакте человеку — за сутки до выхода.
 *
 * Бот туда не публикует, поэтому «напоминание» здесь не вежливость, а сама
 * публикация, только руками: он присылает картинку и готовый текст, а
 * человек ставит отложку в сообществе.
 *
 * Картинку отправляем отдельным сообщением, а не подписью к ней: тексты у
 * нас длиннее тысячи символов, а подпись телеграм обрезает. И отдаём мы её
 * тем же файлом, что придёт в канал, — чтобы в двух сетях был один кадр.
 *
 * Отдаём по одному посту за сообщение, а не списком: списком его не
 * скопируешь, а копировать придётся.
 */
async function handOffVkPosts(): Promise<void> {
  const soon = new Date(Date.now() + WARN_AHEAD_MS);

  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: { in: ["draft", "approved"] },
      kind: "post",
      networks: { in: ["vk", "both"] },
      vkPostId: null,
      vkHandedAt: null,
      // Без нижней границы намеренно: пост, заведённый меньше чем за сутки
      // до выхода, иначе не отдался бы вовсе.
      publishAt: { lte: soon },
    },
    orderBy: { publishAt: "asc" },
    take: 5,
  });

  if (posts.length === 0) return;

  const when = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const to = admin();
  if (!to) return;

  for (const post of posts) {
    if (post.photoFileId) {
      await sendPhoto(to, post.photoFileId, `${post.key} — картинка к посту`).catch(
        () => {},
      );
    }

    const head =
      `<b>Для ВКонтакте: ${when.format(post.publishAt)}</b>\n` +
      `Ключ ${post.key}\n` +
      (post.photoFileId ? "" : "⚠️ Картинки у меня нет — пришлите её мне с подписью-ключом\n") +
      `\nТекст ниже отдельным сообщением, чтобы удобно было скопировать.`;

    await sendMessage(to, head).catch(() => {});
    // Текст без разметки и без всего лишнего: его копируют целиком.
    await sendMessage(to, post.textVk).catch(() => {});

    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { vkHandedAt: new Date() },
    });
  }
}

/** Один проход по очереди. */
async function tick(): Promise<void> {
  await handOffVkPosts();
  await warnAboutMissingPhotos();

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

    // Отсутствие картинки роняет пост только там, где боту действительно
    // есть что публиковать. У записи для одного ВКонтакте он ничего не
    // публикует, и «не вышел» про неё — неправда: её ставил человек, и
    // картинку он получил сутки назад вместе с текстом.
    const needsTelegram = post.networks === "both" || post.networks === "tg";

    if (post.needsPhoto && !post.photoFileId && needsTelegram) {
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

/**
 * Разбор чужих сообществ — дважды в день.
 *
 * Отметку о последнем заходе держим не в памяти, а в самих сообществах:
 * перезапуск контейнера посреди дня иначе запускал бы разбор заново.
 *
 * Молчим, когда находок нет. Сообщение «ничего не нашлось» дважды в день
 * быстро научило бы не читать эти письма — а вместе с ними и те, в которых
 * что-то есть.
 */
async function scanTrendsInBackground(): Promise<void> {
  const hour = Number(
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );

  if (!TREND_HOURS.includes(hour)) return;

  const recently = await prisma.trendSource.findFirst({
    where: {
      enabled: true,
      checkedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
  });
  if (recently) return;

  const { findTrends } = await import("@/lib/social/trends");
  const { trends, errors } = await findTrends();

  for (const error of errors) console.error("тренды:", error);
  if (trends.length === 0) return;

  const lines = trends.slice(0, 5).map((trend) => {
    const head = `<b>${trend.handle}</b> — ${trend.views} просмотров при медиане ${trend.median} (в ${trend.ratio} раза)`;
    // Переводы строк схлопываем: в сообщении их и так хватает.
    const body = trend.text.slice(0, 220).replace(/\s+/g, " ");
    return `${head}
${body}
${trend.url}`;
  });

  await tellAdmin(
    `Взлетело в чужих сообществах:

${lines.join("\n\n")}

Сделать похожее у нас?`,
  );
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

      refreshFeedsInBackground();
      await scanTrendsInBackground().catch((error) =>
        console.error("тренды: разбор не удался", error),
      );
      await tick();
    } catch (error) {
      console.error("посты: проход не удался", error);
    }

    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}
