import { prisma } from "@/lib/prisma";
import { marketPriceRange } from "@/lib/budget";
import { recommendIdeas, RecommendError, isRecommendConfigured } from "@/lib/recommend";
import { startOfDay } from "@/lib/recommendLimit";
import { SITE_URL } from "@/lib/site";
import {
  marketDeliveryInterval,
  needsLocalPurchase,
  parseUrgency,
} from "@/lib/timeframe";
import { buildYandexMapsUrl, buildYandexSearchUrl } from "@/lib/yandexMarket";
import type { GiftIdea } from "@/lib/types";
import {
  handleAdminCallback,
  handleAdminCommand,
} from "@/lib/social/admin";
import {
  answerCallback,
  clearKeyboard,
  sendMessage,
  sendTyping,
  type InlineKeyboard,
} from "@/lib/telegram/api";

/** Сколько подборов в сутки доступно одному чату. Как у зарегистрированных. */
const DAILY_LIMIT = 5;

/**
 * Шаги разговора. На сайте анкета — одна форма, и это нормально для страницы.
 * В переписке длинная форма выглядит допросом, поэтому вопросы идут по одному
 * и почти все отвечаются кнопками.
 */
type Step =
  | "idle"
  | "recipient"
  | "recipient_custom"
  | "child_age"
  | "occasion"
  | "occasion_custom"
  | "budget"
  | "timeframe"
  | "city"
  | "interests";

interface Draft {
  name?: string;
  relationship?: string;
  gender?: string;
  age?: number;
  occasion?: string;
  budget?: string;
  timeframe?: string;
  city?: string;
  interests?: string;
}

interface Option {
  code: string;
  label: string;
  /** Что уйдёт в анкету. Если не задано — берём label. */
  value?: string;
  gender?: string;
  child?: boolean;
}

const RECIPIENTS: Option[] = [
  { code: "mom", label: "Маме", value: "мама", gender: "female" },
  { code: "dad", label: "Папе", value: "папа", gender: "male" },
  { code: "wife", label: "Жене, девушке", value: "жена или девушка", gender: "female" },
  { code: "husb", label: "Мужу, парню", value: "муж или парень", gender: "male" },
  { code: "friendf", label: "Подруге", value: "подруга", gender: "female" },
  { code: "friendm", label: "Другу", value: "друг", gender: "male" },
  { code: "colleague", label: "Коллеге", value: "коллега" },
  { code: "childf", label: "Девочке", value: "девочка", gender: "female", child: true },
  { code: "childm", label: "Мальчику", value: "мальчик", gender: "male", child: true },
  { code: "other", label: "Другое", value: "" },
];

const OCCASIONS: Option[] = [
  { code: "bd", label: "День рождения" },
  { code: "ny", label: "Новый год" },
  { code: "jub", label: "Юбилей" },
  { code: "m8", label: "8 марта" },
  { code: "f23", label: "23 февраля" },
  { code: "wed", label: "Свадьба" },
  { code: "just", label: "Просто так" },
  { code: "other", label: "Другое" },
];

const BUDGETS: Option[] = [
  { code: "b1", label: "до 1000 ₽", value: "до 1000" },
  { code: "b2", label: "1000–3000 ₽", value: "1000-3000" },
  { code: "b3", label: "3000–7000 ₽", value: "3000-7000" },
  { code: "b4", label: "7000–15000 ₽", value: "7000-15000" },
  { code: "b5", label: "больше 15000 ₽", value: "от 15000" },
];

const TIMEFRAMES: Option[] = [
  { code: "t1", label: "Сегодня", value: "сегодня" },
  { code: "t2", label: "На днях", value: "на днях" },
  { code: "t3", label: "Есть время", value: "через неделю" },
];

/** Раскладывает кнопки по два в ряд: в один влезает мало, в три — не читается. */
function grid(options: Option[], step: string, perRow = 2): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < options.length; i += perRow) {
    rows.push(
      options.slice(i, i + perRow).map((option) => ({
        text: option.label,
        callback_data: `${step}:${option.code}`,
      })),
    );
  }
  return rows;
}

function find(options: Option[], code: string): Option | undefined {
  return options.find((option) => option.code === code);
}

async function loadChat(chatId: string) {
  return prisma.telegramChat.upsert({
    where: { id: chatId },
    update: {},
    create: { id: chatId },
  });
}

async function save(chatId: string, step: Step, draft: Draft) {
  await prisma.telegramChat.update({
    where: { id: chatId },
    data: { step, draftJson: draft as object },
  });
}

async function askRecipient(chatId: string) {
  await sendMessage(
    chatId,
    "Кому подбираем подарок?",
    grid(RECIPIENTS, "recipient"),
  );
}

async function askOccasion(chatId: string) {
  await sendMessage(chatId, "По какому поводу?", grid(OCCASIONS, "occasion"));
}

async function askBudget(chatId: string) {
  await sendMessage(chatId, "Сколько готовы потратить?", grid(BUDGETS, "budget"));
}

async function askTimeframe(chatId: string) {
  await sendMessage(
    chatId,
    "Когда нужен подарок?",
    grid(TIMEFRAMES, "timeframe", 3),
  );
}

async function askInterests(chatId: string) {
  await sendMessage(
    chatId,
    "Последнее и самое важное: чем человек увлекается? Пара слов — именно отсюда берутся неочевидные идеи.",
    [[{ text: "Не знаю, пропустить", callback_data: "interests:skip" }]],
  );
}

/**
 * Ссылка для идеи. Логика та же, что на сайте: если подарок нужен сегодня и
 * доставка в этот город не успеет — ведём в магазины рядом, а не на маркетплейс.
 */
function ideaUrl(idea: GiftIdea, draft: Draft): string {
  const urgency = parseUrgency(draft.timeframe);
  const city = draft.city ?? null;

  if (idea.kind === "local") {
    return buildYandexSearchUrl(idea.searchQuery, city);
  }

  if (needsLocalPurchase(urgency, city) && city) {
    return buildYandexMapsUrl(idea.searchQuery, city);
  }

  const price = marketPriceRange(draft.budget);
  const delivery = marketDeliveryInterval(urgency);

  const params = new URLSearchParams({ q: idea.searchQuery, src: "tg" });
  if (price.from) params.set("from", String(price.from));
  if (price.to) params.set("to", String(price.to));
  if (delivery !== undefined) params.set("d", String(delivery));

  // Адрес абсолютный: кнопка-ссылка в телеграме относительных не понимает.
  return `${SITE_URL}/api/market-link?${params.toString()}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function deliverIdeas(chatId: string, ideas: GiftIdea[], draft: Draft) {
  const body = ideas
    .map(
      (idea, i) =>
        `<b>${i + 1}. ${escapeHtml(idea.name)}</b>\n${escapeHtml(idea.reason)}`,
    )
    .join("\n\n");

  // Кнопка на каждую идею: по одной в ряд, иначе названия обрезаются.
  const keyboard: InlineKeyboard = ideas.map((idea, i) => [
    { text: `${i + 1}. ${idea.name}`.slice(0, 60), url: ideaUrl(idea, draft) },
  ]);

  keyboard.push([
    { text: "Ещё идеи", callback_data: "more" },
    { text: "Другой подарок", callback_data: "restart" },
  ]);

  await sendMessage(chatId, body, keyboard);
}

/** Сколько подборов чат сделал за сегодня. */
async function countToday(chatId: string): Promise<number> {
  return prisma.search.count({
    where: {
      profile: { telegramChat: chatId },
      createdAt: { gte: startOfDay() },
    },
  });
}

async function generate(chatId: string, draft: Draft, continueFrom?: string | null) {
  if ((await countToday(chatId)) >= DAILY_LIMIT) {
    await sendMessage(
      chatId,
      `На сегодня подборы закончились — их ${DAILY_LIMIT} в сутки. Лимит обновится в полночь по Москве.`,
    );
    return;
  }

  if (!isRecommendConfigured()) {
    await sendMessage(chatId, "Подбор временно недоступен. Попробуйте позже.");
    return;
  }

  await sendTyping(chatId);

  const profile = await prisma.profile.create({
    data: {
      telegramChat: chatId,
      name: draft.name ?? draft.relationship ?? "получатель",
      relationship: draft.relationship,
      gender: draft.gender,
      age: draft.age,
      interests: draft.interests,
    },
  });

  // «Ещё идеи»: показанное отдаём модели как запрет, иначе она повторится.
  let previous: GiftIdea[] = [];
  if (continueFrom) {
    const earlier = await prisma.search.findUnique({
      where: { id: continueFrom },
      select: { resultJson: true },
    });
    previous = (earlier?.resultJson as unknown as GiftIdea[] | null) ?? [];
  }

  let ideas: GiftIdea[];
  try {
    ideas = await recommendIdeas({
      exclude: previous.map((idea) => idea.name),
      profileName: profile.name,
      gender: draft.gender,
      age: draft.age,
      relationship: draft.relationship,
      interests: draft.interests,
      occasion: draft.occasion ?? "день рождения",
      budget: draft.budget,
      timeframe: draft.timeframe,
      city: draft.city,
    });
  } catch (error) {
    const message =
      error instanceof RecommendError
        ? error.message
        : "Не удалось подобрать идеи. Попробуйте ещё раз.";
    await sendMessage(chatId, message);
    return;
  }

  const search = await prisma.search.create({
    data: {
      profileId: profile.id,
      occasion: draft.occasion ?? "день рождения",
      budget: draft.budget,
      timeframe: draft.timeframe,
      city: draft.city,
      resultJson: [...previous, ...ideas] as object,
    },
  });

  await prisma.telegramChat.update({
    where: { id: chatId },
    data: { step: "idle", lastSearchId: search.id },
  });

  await deliverIdeas(chatId, ideas, draft);
}

const GREETING =
  "Привет! Я Дарибот — помогу выбрать подарок.\n\n" +
  "Задам пять коротких вопросов и предложу шесть идей с объяснением, " +
  "почему каждая подойдёт именно этому человеку.";

export async function handleMessage(
  chatId: string,
  text: string,
): Promise<void> {
  // Команды расписания понимает только владелец, и они не должны попадать
  // в обычный разговор: «/plan» не вопрос про подарок.
  if (await handleAdminCommand(chatId, text)) return;

  const chat = await loadChat(chatId);
  const draft = (chat.draftJson as Draft | null) ?? {};
  const trimmed = text.trim();

  if (trimmed.startsWith("/start") || trimmed === "/help") {
    // Ссылка вида t.me/бот?start=vc приходит сюда как «/start vc». Метку
    // запоминаем один раз: иначе повторный /start затрёт настоящий источник.
    const tag = trimmed.split(/s+/)[1]?.slice(0, 20);
    if (tag && !chat.source) {
      await prisma.telegramChat.update({
        where: { id: chatId },
        data: { source: tag },
      });
    }

    await save(chatId, "recipient", {});
    await sendMessage(chatId, GREETING);
    await askRecipient(chatId);
    return;
  }

  switch (chat.step as Step) {
    case "recipient_custom":
      draft.relationship = trimmed.slice(0, 60);
      draft.name = trimmed.slice(0, 60);
      await save(chatId, "occasion", draft);
      await askOccasion(chatId);
      return;

    case "child_age": {
      const age = Number(trimmed.replace(/\D/g, ""));
      if (!age || age > 100) {
        await sendMessage(chatId, "Напишите возраст числом, например: 8");
        return;
      }
      draft.age = age;
      await save(chatId, "occasion", draft);
      await askOccasion(chatId);
      return;
    }

    case "occasion_custom":
      draft.occasion = trimmed.slice(0, 60);
      await save(chatId, "budget", draft);
      await askBudget(chatId);
      return;

    case "city":
      draft.city = trimmed.slice(0, 60);
      await save(chatId, "interests", draft);
      await askInterests(chatId);
      return;

    case "interests":
      draft.interests = trimmed.slice(0, 300);
      await save(chatId, "idle", draft);
      await generate(chatId, draft);
      return;

    default:
      await sendMessage(chatId, GREETING);
      await save(chatId, "recipient", {});
      await askRecipient(chatId);
  }
}

export async function handleCallback(
  chatId: string,
  messageId: number,
  data: string,
  callbackId: string,
): Promise<void> {
  if (await handleAdminCallback(chatId, data, callbackId)) return;

  await answerCallback(callbackId);

  const chat = await loadChat(chatId);
  const draft = (chat.draftJson as Draft | null) ?? {};
  const [step, code] = data.split(":");

  if (step === "restart") {
    await save(chatId, "recipient", {});
    await askRecipient(chatId);
    return;
  }

  if (step === "more") {
    await generate(chatId, draft, chat.lastSearchId);
    return;
  }

  // Кнопки прежнего вопроса убираем, чтобы на них нельзя было нажать второй раз.
  await clearKeyboard(chatId, messageId);

  switch (step) {
    case "recipient": {
      const option = find(RECIPIENTS, code);
      if (!option) return;

      if (option.code === "other") {
        await save(chatId, "recipient_custom", draft);
        await sendMessage(chatId, "Кому подбираем? Напишите своими словами.");
        return;
      }

      draft.relationship = option.value ?? option.label;
      draft.name = option.value ?? option.label;
      draft.gender = option.gender;

      if (option.child) {
        await save(chatId, "child_age", draft);
        await sendMessage(chatId, "Сколько лет? Напишите числом.");
        return;
      }

      await save(chatId, "occasion", draft);
      await askOccasion(chatId);
      return;
    }

    case "occasion": {
      const option = find(OCCASIONS, code);
      if (!option) return;

      if (option.code === "other") {
        await save(chatId, "occasion_custom", draft);
        await sendMessage(chatId, "По какому поводу? Напишите своими словами.");
        return;
      }

      draft.occasion = option.label;
      await save(chatId, "budget", draft);
      await askBudget(chatId);
      return;
    }

    case "budget": {
      const option = find(BUDGETS, code);
      if (!option) return;
      draft.budget = option.value;
      await save(chatId, "timeframe", draft);
      await askTimeframe(chatId);
      return;
    }

    case "timeframe": {
      const option = find(TIMEFRAMES, code);
      if (!option) return;
      draft.timeframe = option.value;

      // Город спрашиваем только когда подарок нужен сегодня: тогда от него
      // зависит, вести человека в магазины рядом или на маркетплейс.
      if (option.code === "t1") {
        await save(chatId, "city", draft);
        await sendMessage(chatId, "В каком вы городе?");
        return;
      }

      await save(chatId, "interests", draft);
      await askInterests(chatId);
      return;
    }

    case "interests":
      await save(chatId, "idle", draft);
      await generate(chatId, draft);
      return;
  }
}
