import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProfileInput } from "@/lib/types";

export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const profiles = await prisma.profile.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body: ProfileInput | null = await request.json().catch(() => null);

  if (!body?.name) {
    return NextResponse.json(
      { error: "Укажите имя получателя" },
      { status: 400 },
    );
  }

  const profile = await prisma.profile.create({
    data: {
      userId: authUser.id,
      name: body.name,
      gender: body.gender,
      age: body.age,
      relationship: body.relationship,
      job: body.job,
      interests: body.interests,
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}
