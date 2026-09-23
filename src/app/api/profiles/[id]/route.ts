import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProfileInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const profile = await prisma.profile.findFirst({
    where: { id, userId: authUser.id },
    include: { searches: { orderBy: { createdAt: "desc" } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.profile.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  const body: Partial<ProfileInput> | null = await request
    .json()
    .catch(() => null);

  // Имя — единственное обязательное поле профиля. Без этой проверки форма,
  // отправленная в обход браузера, оставила бы получателя без названия.
  if (body?.name !== undefined && !String(body.name).trim()) {
    return NextResponse.json(
      { error: "Укажите имя получателя" },
      { status: 400 },
    );
  }

  const profile = await prisma.profile.update({
    where: { id },
    data: {
      name: body?.name ?? undefined,
      gender: body?.gender,
      age: body?.age,
      relationship: body?.relationship,
      job: body?.job,
      interests: body?.interests,
    },
  });

  return NextResponse.json({ profile });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.profile.findFirst({
    where: { id, userId: authUser.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  await prisma.profile.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
