import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const searches = await prisma.search.findMany({
    where: { profile: { userId: authUser.id } },
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ searches });
}
