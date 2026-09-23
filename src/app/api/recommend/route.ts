import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mockRecommend } from "@/lib/mockRecommend";
import {
  isRecommendConfigured,
  recommendIdeas,
  RecommendError,
} from "@/lib/recommend";
import {
  DAILY_RECOMMEND_LIMIT,
  countTodaySearches,
} from "@/lib/recommendLimit";
import { checkGuestQuota, readGuestId } from "@/lib/guest";
import { getClientIp } from "@/lib/rateLimit";
import type { GiftIdea, RecommendRequestBody } from "@/lib/types";

// Ответ ИИ может идти десятки секунд — не даём хостингу оборвать функцию рано.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authUser = await getCurrentUser();
  const guestId = authUser ? null : await readGuestId();

  if (!authUser && !guestId) {
    // Гость без куки — значит, и профиля у него быть не может.
    return NextResponse.json({ error: "Начните с анкеты" }, { status: 400 });
  }

  if (authUser) {
    // Считаем тем же кодом, что и счётчик в шапке: иначе человек увидит
    // «осталось 1», нажмёт и получит отказ.
    const todayCount = await countTodaySearches(authUser.id);

    if (todayCount >= DAILY_RECOMMEND_LIMIT) {
      return NextResponse.json(
        {
          error: `Достигнут дневной лимит подбора подарков (${DAILY_RECOMMEND_LIMIT} в день). Лимит обновится в полночь по Москве.`,
        },
        { status: 429 },
      );
    }
  } else {
    const quota = await checkGuestQuota(guestId!, getClientIp(request));
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            quota.reason === "ip"
              ? "Сегодня с этого устройства уже сделано несколько подборов без регистрации. Зарегистрируйтесь, чтобы продолжить."
              : "Первый подбор готов. Зарегистрируйтесь, чтобы сохранить его и получить ещё пять в день.",
          needsAccount: true,
        },
        { status: 429 },
      );
    }
  }

  const body: RecommendRequestBody | null = await request
    .json()
    .catch(() => null);

  if (!body?.profileId || !body?.occasion) {
    return NextResponse.json(
      { error: "Укажите профиль получателя и повод" },
      { status: 400 },
    );
  }

  // Владелец профиля — либо аккаунт, либо гость с той же кукой.
  const owner = authUser ? { userId: authUser.id } : { guestId };

  const profile = await prisma.profile.findFirst({
    where: { id: body.profileId, ...owner },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  // «Смотреть ещё»: продолжаем прежний подбор. Показанные идеи нужны дважды —
  // как запрет для модели и как начало итогового списка.
  let previous: GiftIdea[] = [];
  if (body.continueSearchId) {
    const earlier = await prisma.search.findFirst({
      where: { id: body.continueSearchId, profile: owner },
      select: { resultJson: true },
    });
    if (!earlier) {
      return NextResponse.json(
        { error: "Предыдущий подбор не найден" },
        { status: 404 },
      );
    }
    previous = (earlier.resultJson as unknown as GiftIdea[] | null) ?? [];
  }

  let ideas: GiftIdea[];

  if (isRecommendConfigured()) {
    try {
      ideas = await recommendIdeas({
        exclude: previous.map((idea) => idea.name),
        profileName: profile.name,
        gender: profile.gender,
        age: profile.age,
        relationship: profile.relationship,
        job: profile.job,
        interests: profile.interests,
        occasion: body.occasion,
        budget: body.budget,
        timeframe: body.timeframe,
        city: body.city,
        mood: body.mood,
      });
    } catch (error) {
      const message =
        error instanceof RecommendError
          ? error.message
          : "Не удалось подобрать идеи, попробуйте ещё раз";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else if (process.env.NODE_ENV !== "production") {
    ideas = mockRecommend({
      profileName: profile.name,
      occasion: body.occasion,
      budget: body.budget,
      timeframe: body.timeframe,
      city: body.city,
      mood: body.mood,
      interests: profile.interests,
    });
  } else {
    console.error("Не настроен ни один провайдер ИИ: нет ключей ни Яндекса, ни Anthropic");
    return NextResponse.json(
      { error: "Подбор временно недоступен" },
      { status: 503 },
    );
  }

  // Отсеиваем повторы по названию на случай, если модель всё же предложила
  // уже показанное: запрет в промпте она соблюдает не всегда.
  const seen = new Set(previous.map((idea) => idea.name.toLowerCase()));
  const fresh = ideas.filter((idea) => !seen.has(idea.name.toLowerCase()));

  if (previous.length > 0 && fresh.length === 0) {
    return NextResponse.json(
      { error: "Новых идей не нашлось. Попробуйте изменить условия подбора." },
      { status: 502 },
    );
  }

  const combined = [...previous, ...fresh];

  // Новая запись, а не правка прежней: так «Смотреть ещё» расходует дневной
  // лимит (он считает записи о подборах) и попадает в историю.
  const search = await prisma.search.create({
    data: {
      profileId: profile.id,
      occasion: body.occasion,
      budget: body.budget,
      timeframe: body.timeframe,
      city: body.city,
      mood: body.mood,
      resultJson: combined as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(
    { searchId: search.id, ideas: combined },
    { status: 201 },
  );
}
