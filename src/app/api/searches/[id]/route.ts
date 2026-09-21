import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const search = await prisma.search.findFirst({
    where: { id, profile: { userId: authUser.id } },
    include: { profile: true },
  });

  if (!search) {
    return NextResponse.json({ error: "Результат не найден" }, { status: 404 });
  }

  return NextResponse.json({ search });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.search.findFirst({
    where: { id, profile: { userId: authUser.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Результат не найден" }, { status: 404 });
  }

  await prisma.search.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
