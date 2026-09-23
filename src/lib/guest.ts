import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/recommendLimit";

export const GUEST_COOKIE = "daribot_guest";

/** Сколько подборов гость может сделать без регистрации. */
export const GUEST_SEARCH_LIMIT = 1;

/**
 * Сколько гостевых подборов допускаем с одного адреса за сутки. Куку легко
 * стереть, и без этого предела бесплатный подбор становится безлимитным.
 */
const GUEST_SEARCHES_PER_IP = 3;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Читает идентификатор гостя из куки. Ничего не создаёт. */
export async function readGuestId(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value ?? null;
}

/**
 * Идентификатор гостя для маршрута, который вправе его завести.
 * Куку выставляем на ответе: в Route Handler это единственный способ.
 */
export function ensureGuestId(
  existing: string | null,
  response: NextResponse,
): string {
  if (existing) return existing;

  const id = randomUUID();
  response.cookies.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return id;
}

export interface GuestQuota {
  allowed: boolean;
  reason?: "guest" | "ip";
}

/** Проверяет, остались ли у гостя бесплатные подборы. */
export async function checkGuestQuota(
  guestId: string,
  ip: string,
): Promise<GuestQuota> {
  const byGuest = await prisma.search.count({
    where: { profile: { guestId } },
  });
  if (byGuest >= GUEST_SEARCH_LIMIT) {
    return { allowed: false, reason: "guest" };
  }

  const byIp = await prisma.search.count({
    where: {
      profile: { guestIp: ip, userId: null },
      createdAt: { gte: startOfDay() },
    },
  });
  if (byIp >= GUEST_SEARCHES_PER_IP) {
    return { allowed: false, reason: "ip" };
  }

  return { allowed: true };
}

/**
 * Присваивает аккаунту всё, что человек успел создать гостем.
 * Вызывается при входе и при подтверждении почты: к этому моменту у нас
 * есть и пользователь, и кука из того же браузера.
 */
export async function claimGuestProfiles(userId: string): Promise<number> {
  const guestId = await readGuestId();
  if (!guestId) return 0;

  const { count } = await prisma.profile.updateMany({
    where: { guestId, userId: null },
    data: { userId, guestId: null, guestIp: null },
  });

  return count;
}
