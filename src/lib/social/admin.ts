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
  networks: string;
  needsPhoto: boolean;
  photoFileId: string | null;
  vkPostId: string | null;
  vkHandedAt: Date | null;
  error: string | null;
}): string {
  const marks: string[] = [STATUS_LABEL[post.status] ?? post.status];
  if (post.kind !== "post") marks.push(post.kind === "poll" ? "опрос" : "видео");
  if (post.needsPhoto && !post.photoFileId) marks.push("нужно фото");

  // Во ВКонтакте публикует человек, поэтому состояние там своё и в статус
  // поста не укладывается: отдали текст или ещё нет, поставили или ещё нет.
  if ((post.networks === "vk" || post.networks === "both") && !post.vkPostId) {
    marks.push(post.vkHandedAt ? "вк: за вами" : "вк: отдам за сутки");
  }

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

  if (command === "/feeds") {
    const feeds = await prisma.productFeed.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (feeds.length === 0) {
      await sendMessage(
        chatId,
        "Выгрузок нет. Добавить: /feed Название https://адрес",
      );
      return true;
    }

    const total = await prisma.product.count({ where: { available: true } });
    const lines = feeds.map((feed) => {
      const when = feed.importedAt ? MOSCOW.format(feed.importedAt) : "ни разу";
      const trouble = feed.error ? `\n   ошибка: ${feed.error}` : "";
      return `${feed.name} — товаров ${feed.count}, обновлено ${when}${trouble}`;
    });

    await sendMessage(
      chatId,
      `<b>Выгрузки</b>\n\n${lines.join("\n")}\n\nВсего в наличии: ${total}`,
    );
    return true;
  }

  if (command.startsWith("/feed ")) {
    // Название может быть из нескольких слов, адрес всегда последний.
    // Отбор разделов, если он нужен, идёт следом за адресом — иначе
    // большой каталог придётся грузить дважды: сперва целиком, потом
    // заново с отбором.
    const parts = text.trim().split(/\s+/).slice(1);
    const at = parts.findIndex((part) => /^https?:\/\//.test(part));

    if (at < 1) {
      await sendMessage(
        chatId,
        "Нужно так: /feed Название https://адрес\nили с отбором: /feed Название https://адрес книг|детск",
      );
      return true;
    }

    const name = parts.slice(0, at).join(" ");
    const url = parts[at];
    const include = parts.slice(at + 1).join(" ") || null;

    if (include) {
      try {
        new RegExp(include);
      } catch {
        await sendMessage(chatId, "Отбор непонятен. Разделы через | — например: книг|детск");
        return true;
      }
    }

    // Повторная отправка с тем же названием заменяет адрес, а не заводит
    // второй магазин. Первая попытка часто уходит с неполным адресом, и
    // список не должен зарастать её обломками.
    const before = await prisma.productFeed.findFirst({ where: { name } });
    const feed = before
      ? await prisma.productFeed.update({
          where: { id: before.id },
          // Отбор, если он не указан заново, сохраняем: менять адрес и
          // случайно снять фильтр — значит утащить к себе весь каталог.
          data: { url, enabled: true, error: null, ...(include ? { include } : {}) },
        })
      : await prisma.productFeed.create({ data: { name, url, include } });

    await sendMessage(
      chatId,
      `${before ? "Заменил адрес" : "Добавил"} «${name}». Загружаю, это займёт минуту-другую.`,
    );

    const { importFeed } = await import("@/lib/products/import");
    const result = await importFeed(feed);

    await sendMessage(
      chatId,
      result.error
        ? `Не вышло: ${result.error}`
        : `Готово: товаров ${result.saved}${result.skipped ? `, отсеяно ${result.skipped}` : ""}.`,
    );
    return true;
  }

  if (command === "/coverage" || command === "/покрытие") {
    // Где в подборках есть настоящие товары, а где по-прежнему поиск Маркета.
    // Проверка идёт по всем идеям всех подборок, это сотни запросов к базе,
    // поэтому предупреждаем и не торопим.
    await sendMessage(chatId, "Проверяю все подборки, это займёт с полминуты.");

    const { coverage } = await import("@/lib/products/coverage");
    const found = await coverage();

    const empty = found.empty
      .slice(0, 15)
      .map((e) => `• ${e.slug} — «${e.query}»`)
      .join("\n");

    // По две на подборку, а не двадцать подряд. Сортировать по числу
    // найденного бессмысленно: карточек показываем три, и у всех стоит три.
    // Без этого список целиком состоял бы из первых двух подборок.
    const perGuide = new Map<string, number>();
    const candidates = found.candidates
      .filter((c) => {
        const seen = perGuide.get(c.slug) ?? 0;
        if (seen >= 2) return false;
        perGuide.set(c.slug, seen + 1);
        return true;
      })
      .slice(0, 24)
      .map((c) => `• ${c.slug} — ${c.idea} → «${c.query}»`)
      .join("\n");

    await sendMessage(
      chatId,
      `<b>Покрытие подборок</b>\n\n` +
        `Фраз задано: ${found.filled + found.empty.length} — ` +
        `находят ${found.filled}, пусто у ${found.empty.length}\n` +
        `Идей без фразы: ${found.without} — из них нашлось бы у ${found.candidates.length}\n` +
        (empty ? `\n<b>Фраза есть, товара нет</b>\n${empty}\n` : "") +
        (candidates ? `\n<b>Можно добавить фразу</b>\n${candidates}` : ""),
    );
    return true;
  }

  if (command === "/takprodam" || command.startsWith("/takprodam ")) {
    // Такпродам — не файл, а каталог маркетплейсов. Адрес у него свой, под
    // /feed он не подходит, поэтому команда отдельная.
    //
    // Берём каталог целиком: отбирать по разделам заранее — значит решать за
    // подборки, каким товарам в них место. Отбор при показе и так строгий,
    // все слова запроса должны найтись в названии, так что лишнее до
    // страницы не доходит, а нужное находится там, где мы его не ждали.
    const { findSource, takprodamCategories, takprodamTotals } = await import(
      "@/lib/products/takprodam"
    );

    const rest = text.trim().slice("/takprodam".length).trim();

    let source: { id: string; title: string };
    try {
      source = await findSource();
    } catch (error) {
      await sendMessage(
        chatId,
        `Такпродам не отвечает как надо: ${error instanceof Error ? error.message : error}`,
      );
      return true;
    }

    if (!rest) {
      // Без аргументов — разведка: что за площадка, сколько товаров и какие
      // разделы. Разделы нужны не для отбора, а чтобы видеть, что в каталоге
      // вообще есть.
      const [categories, totals] = await Promise.all([
        takprodamCategories().catch(() => []),
        takprodamTotals(source.id).catch(() => []),
      ]);

      const counts = totals.map(
        (t) => `${t.marketplace}: ${t.total === null ? "не сообщил" : t.total}`,
      );
      const list = categories.slice(0, 40).map((c) => `${c.id} — ${c.title}`);

      await sendMessage(
        chatId,
        `<b>Такпродам</b>\n\nПлощадка: ${source.title} (${source.id})\n\n` +
          `<b>Товаров</b>\n${counts.join("\n")}\n\n` +
          `<b>Разделов: ${categories.length}</b>\n` +
          (list.length ? `${list.join("\n")}\n\n` : "\n") +
          "Каталог без ненужных разделов: /takprodam кроме 1,2,14,15,21\n" +
          "Весь каталог целиком: /takprodam всё\n" +
          "Только один маркетплейс: /takprodam Wildberries",
      );
      return true;
    }

    const parts = rest.split(/\s+/);
    const first = parts[0].toLowerCase();
    const whole = first === "всё" || first === "все";

    // «кроме 1,2,14» — взять каталог без названных разделов. Отсеять их по
    // названию нельзя: у товара стоит подраздел, а не раздел, — поэтому
    // пользуемся их отбором и ненужное просто не запрашиваем.
    const except = first === "кроме" ? parts.slice(1).join("").replace(/\s/g, "") : null;

    if (except !== null && !/^\d+(,\d+)*$/.test(except)) {
      await sendMessage(
        chatId,
        "Номера разделов через запятую — например: /takprodam кроме 1,2,14,15,21\n" +
          "Какие есть — покажет /takprodam",
      );
      return true;
    }

    const marketplace = whole || except !== null ? null : parts[0];
    const include = except !== null ? null : parts.slice(1).join(" ") || null;

    if (include) {
      try {
        new RegExp(include);
      } catch {
        await sendMessage(chatId, "Отбор непонятен. Разделы через | — например: игрушк|настольн");
        return true;
      }
    }

    const name = marketplace ? `Такпродам ${marketplace}` : "Такпродам";
    const url = marketplace
      ? `takprodam:?marketplace=${encodeURIComponent(marketplace)}`
      : except !== null
        ? `takprodam:?not_category_id=${except}`
        : "takprodam:";

    const before = await prisma.productFeed.findFirst({ where: { name } });
    const feed = before
      ? await prisma.productFeed.update({
          where: { id: before.id },
          // Отбор снимаем, только если о нём сказали заново. Исключение —
          // «всё»: там его отсутствие и есть смысл команды.
          data: {
            url,
            enabled: true,
            error: null,
            ...(include ? { include } : whole || except !== null ? { include: null } : {}),
          },
        })
      : await prisma.productFeed.create({ data: { name, url, include } });

    await sendMessage(
      chatId,
      `${before ? "Обновляю" : "Добавил"} «${name}». ` +
        "Каталог постраничный, по тысяче товаров за раз — это надолго.",
    );

    const { importFeed } = await import("@/lib/products/import");
    const result = await importFeed(feed);

    await sendMessage(
      chatId,
      result.error
        ? `Не вышло: ${result.error}`
        : `Готово: товаров ${result.saved}${result.skipped ? `, отсеяно ${result.skipped}` : ""}.` +
          (result.note ? `\n\nНо: ${result.note}.` : ""),
    );
    return true;
  }

  if (command.startsWith("/filter ")) {
    // Какие разделы магазина брать. Без этого большие каталоги приносят
    // сотни тысяч товаров, из которых в подарок годятся единицы.
    const rest = text.trim().slice(8).trim();
    const space = rest.indexOf(" ");
    const name = space === -1 ? rest : rest.slice(0, space);
    const include = space === -1 ? "" : rest.slice(space + 1).trim();

    const feed = await prisma.productFeed.findFirst({ where: { name } });
    if (!feed) {
      await sendMessage(chatId, `Не нашёл магазин «${name}». Список — в /feeds.`);
      return true;
    }

    try {
      if (include) new RegExp(include);
    } catch {
      await sendMessage(chatId, "Это выражение мне непонятно. Разделы через | — например: книги|подарочн");
      return true;
    }

    await prisma.productFeed.update({
      where: { id: feed.id },
      data: { include: include || null },
    });

    await sendMessage(
      chatId,
      include
        ? `«${name}»: беру только разделы по «${include}». Загружаю заново…`
        : `«${name}»: беру все разделы. Загружаю заново…`,
    );

    // Старое чистим: товары из отсеянных разделов иначе остались бы висеть.
    await prisma.product.deleteMany({ where: { feedId: feed.id } });

    const { importFeed } = await import("@/lib/products/import");
    const result = await importFeed({ ...feed, include: include || null });

    await sendMessage(
      chatId,
      result.error
        ? `Не вышло: ${result.error}`
        : `Готово: товаров ${result.saved}, отсеяно ${result.skipped}.`,
    );
    return true;
  }

  if (command.startsWith("/unfeed ")) {
    const name = text.trim().slice(8).trim();
    // Товары уходят вместе с магазином: ссылки на них партнёрские, и без
    // магазина они всё равно ничего не стоят.
    const removed = await prisma.productFeed.deleteMany({ where: { name } });
    await sendMessage(
      chatId,
      removed.count > 0
        ? `Убрал «${name}» и его товары.`
        : `Не нашёл магазин «${name}». Список — в /feeds.`,
    );
    return true;
  }

  if (command === "/import") {
    await sendMessage(chatId, "Обновляю выгрузки…");
    const { importDueFeeds } = await import("@/lib/products/import");
    const results = await importDueFeeds(true);

    await sendMessage(
      chatId,
      results.length === 0
        ? "Выгрузок нет."
        : results
            .map((r) =>
              r.error
                ? `${r.feed}: ${r.error}`
                : `${r.feed}: товаров ${r.saved}, пропало ${r.gone}`,
            )
            .join("\n"),
    );
    return true;
  }

  if (command === "/sources") {
    const sources = await prisma.trendSource.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (sources.length === 0) {
      await sendMessage(
        chatId,
        "Слежу пока ни за кем. Добавить: /source короткое_имя_сообщества",
      );
      return true;
    }

    const rows = sources.map((source) => {
      const when = source.checkedAt ? MOSCOW.format(source.checkedAt) : "ни разу";
      const trouble = source.error ? ` · ${source.error}` : "";
      return `${source.handle} — медиана ${source.median}, смотрел ${when}${trouble}`;
    });

    await sendMessage(chatId, `<b>За кем слежу</b>\n\n${rows.join("\n")}`);
    return true;
  }

  if (command.startsWith("/source ")) {
    // Принимаем и ссылку целиком: копировать из адресной строки удобнее,
    // чем выковыривать короткое имя.
    const handle = text
      .trim()
      .slice(8)
      .trim()
      .replace(/^https?:\/\/(m\.)?vk\.(com|ru)\//i, "")
      .replace(/\/.*$/, "");

    if (!handle) {
      await sendMessage(chatId, "Нужно так: /source nahodki_wb");
      return true;
    }

    await prisma.trendSource.upsert({
      where: { network_handle: { network: "vk", handle } },
      update: { enabled: true, error: null },
      create: { network: "vk", handle },
    });

    await sendMessage(chatId, `Добавил «${handle}». Смотрю…`);

    const { scanSource } = await import("@/lib/social/trends");
    const source = await prisma.trendSource.findFirst({ where: { handle } });

    try {
      const found = await scanSource(source!);
      const after = await prisma.trendSource.findFirst({ where: { handle } });
      await sendMessage(
        chatId,
        `Готово. Медиана просмотров — ${after?.median ?? 0}, взлетевших записей сейчас: ${found.length}.`,
      );
    } catch (error) {
      await sendMessage(
        chatId,
        `Не вышло прочитать: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`,
      );
    }
    return true;
  }

  if (command.startsWith("/unsource ")) {
    const handle = text.trim().slice(10).trim();
    const removed = await prisma.trendSource.deleteMany({ where: { handle } });
    await sendMessage(
      chatId,
      removed.count > 0
        ? `Больше не слежу за «${handle}».`
        : `Не нашёл «${handle}». Список — в /sources.`,
    );
    return true;
  }

  if (command === "/trends") {
    await sendMessage(chatId, "Смотрю чужие сообщества…");

    const { findTrends } = await import("@/lib/social/trends");
    const { trends, errors } = await findTrends();

    if (trends.length === 0) {
      await sendMessage(
        chatId,
        errors.length > 0
          ? `Ничего не взлетело. Не прочитались: ${errors.join("; ")}`
          : "Ничего не взлетело — ни одна запись не обогнала своё сообщество втрое.",
      );
      return true;
    }

    const rows = trends.slice(0, 5).map((trend) => {
      const head = `<b>${trend.handle}</b> — ${trend.views} просмотров при медиане ${trend.median} (в ${trend.ratio} раза)`;
      return `${head}\n${trend.text.slice(0, 220).replace(/\s+/g, " ")}\n${trend.url}`;
    });

    await sendMessage(chatId, rows.join("\n\n"));
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
    // Именно \s+. Без обратной косой это регулярка из буквы «s», и команда
    // разваливалась: ключ «2026-10-03-thermos» она резала по «s» внутри
    // слова, а ключ без «s» не резала вовсе.
    const [, key, network] = text.trim().split(/\s+/);
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
