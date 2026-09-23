import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureGuestId, readGuestId } from "@/lib/guest";
import { getClientIp } from "@/lib/rateLimit";
import type { ProfileInput } from "@/lib/types";

export async function GET() {
  const authUser = await getCurrentUser();

  // Гостю показываем его собственные профили: он мог начать подбор,
  // не регистрируясь, и должен видеть, кого уже описал.
  const where = authUser
    ? { userId: authUser.id }
    : { guestId: (await readGuestId()) ?? "__none__" };

  const profiles = await prisma.profile.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const authUser = await getCurrentUser();

  const body: ProfileInput | null = await request.json().catch(() => null);

  if (!body?.name) {
    return NextResponse.json(
      { error: "Укажите имя получателя" },
      { status: 400 },
    );
  }

  const data = {
    name: body.name,
    gender: body.gender,
    age: body.age,
    relationship: body.relationship,
    job: body.job,
    interests: body.interests,
  };

  if (authUser) {
    const profile = await prisma.profile.create({
      data: { ...data, userId: authUser.id },
    });
    return NextResponse.json({ profile }, { status: 201 });
  }

  // Ответ создаём заранее: куку гостя можно выставить только на нём.
  const response = NextResponse.json({ profile: null }, { status: 201 });
  const guestId = ensureGuestId(await readGuestId(), response);

  const profile = await prisma.profile.create({
    data: { ...data, guestId, guestIp: getClientIp(request) },
  });

  return NextResponse.json(
    { profile },
    { status: 201, headers: response.headers },
  );
}
