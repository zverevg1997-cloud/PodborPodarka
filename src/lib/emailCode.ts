import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type CodePurpose = "confirm" | "reset";

/** Сколько живёт код из письма. */
const TTL_MINUTES = 30;

/** Сколько раз можно ошибиться, прежде чем код перестанет действовать. */
const MAX_ATTEMPTS = 5;

/** Не чаще одного письма в минуту на аккаунт. */
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Шестизначный код. randomInt берёт случайность у системы, не у Math.random. */
function generateCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: "cooldown"; secondsLeft: number };

/**
 * Выдаёт новый код, гася предыдущие невостребованные: иначе у человека на
 * руках оказывается несколько действующих кодов, и он вводит не тот.
 */
export async function issueCode(
  userId: string,
  purpose: CodePurpose,
): Promise<IssueResult> {
  const last = await prisma.emailToken.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (last) {
    const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        reason: "cooldown",
        secondsLeft: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  await prisma.emailToken.deleteMany({ where: { userId, purpose } });

  const code = generateCode();
  await prisma.emailToken.create({
    data: {
      userId,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  return { ok: true, code };
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "wrong" | "too_many" };

/**
 * Проверяет код. Неверные попытки считаются: шестизначный код без такого
 * счётчика перебирается за считаные минуты.
 */
export async function verifyCode(
  userId: string,
  code: string,
  purpose: CodePurpose,
): Promise<VerifyResult> {
  const token = await prisma.emailToken.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!token) return { ok: false, reason: "not_found" };

  if (token.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }

  if (token.codeHash !== hashCode(code)) {
    await prisma.emailToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "wrong" };
  }

  await prisma.emailToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId };
}

/** Человеческий текст для каждой причины отказа. */
export function verifyErrorText(reason: Exclude<VerifyResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "expired":
      return "Код устарел. Запросите новый.";
    case "too_many":
      return "Слишком много неверных попыток. Запросите новый код.";
    case "not_found":
      return "Код не найден. Запросите новый.";
    default:
      return "Код неверный. Проверьте и введите ещё раз.";
  }
}
