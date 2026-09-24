import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "daribot_session";

/** Сколько живёт сессия без входа заново. */
const TTL_DAYS = 30;

/** За сколько дней до конца начинаем продлевать при очередном запросе. */
const RENEW_WHEN_LESS_THAN_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

/**
 * В куке лежит случайный токен, в базе — его хэш. Смысл тот же, что и у
 * пароля: чтения базы недостаточно, чтобы войти под чужим именем.
 * Соль здесь не нужна — токен и так случайный, перебирать нечего.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * DAY);

  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  // Изредка подчищаем истёкшие сессии: своего планировщика у нас нет, а
  // таблица иначе растёт без конца. Ответ пользователю этого не ждёт.
  if (Math.random() < 0.02) {
    void prisma.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
  }
}

/**
 * Пользователь текущей сессии или null.
 *
 * Вызывается в том числе из серверных компонентов, где запись кук запрещена,
 * поэтому продление обёрнуто в try — без него страница падала бы с ошибкой
 * вместо того, чтобы просто отрисоваться.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    void prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < RENEW_WHEN_LESS_THAN_DAYS * DAY) {
    const expiresAt = new Date(Date.now() + TTL_DAYS * DAY);
    void prisma.session
      .update({ where: { id: session.id }, data: { expiresAt } })
      .catch(() => {});
    try {
      store.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      });
    } catch {
      // Серверный компонент — куку обновим при следующем запросе к API.
    }
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session
      .delete({ where: { id: hashToken(token) } })
      .catch(() => {
        // Сессии уже нет — значит, цель достигнута.
      });
  }

  store.delete(COOKIE_NAME);
}

/** Завершает все сессии пользователя. Нужно при смене пароля. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export { COOKIE_NAME as SESSION_COOKIE };
