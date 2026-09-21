import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mockRecommend } from "@/lib/mockRecommend";
import type { RecommendRequestBody } from "@/lib/types";

const DAILY_RECOMMEND_LIMIT = 5;

export async function POST(request: NextRequest) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const todayCount = await prisma.search.count({
    where: {
      profile: { userId: authUser.id },
      createdAt: { gte: startOfDay },
    },
  });

  if (todayCount >= DAILY_RECOMMEND_LIMIT) {
    return NextResponse.json(
      {
        error: `Достигнут дневной лимит подбора подарков (${DAILY_RECOMMEND_LIMIT} в день). Попробуйте завтра.`,
      },
      { status: 429 },
    );
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

  const profile = await prisma.profile.findFirst({
    where: { id: body.profileId, userId: authUser.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  // TODO: здесь позже вместо mockRecommend будет сборка промпта из данных
  // профиля/анкеты и реальный вызов Claude API (Anthropic), с парсингом
  // ответа в массив GiftIdea того же формата.
  const ideas = mockRecommend({
    profileName: profile.name,
    occasion: body.occasion,
    budget: body.budget,
    timeframe: body.timeframe,
    city: body.city,
    mood: body.mood,
    interests: profile.interests,
  });

  const search = await prisma.search.create({
    data: {
      profileId: profile.id,
      occasion: body.occasion,
      budget: body.budget,
      timeframe: body.timeframe,
      city: body.city,
      mood: body.mood,
      resultJson: ideas as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ searchId: search.id, ideas }, { status: 201 });
}
