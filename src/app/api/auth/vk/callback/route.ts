import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { SITE_URL } from "@/lib/site";
import {
  exchangeCode,
  VK_STATE_COOKIE,
  VK_VERIFIER_COOKIE,
} from "@/lib/vkAuth";

const fail = (reason: string) =>
  NextResponse.redirect(`${SITE_URL}/login?error=${reason}`);

/** Возврат из ВКонтакте: меняем код на токен и заводим сессию. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return fail("vk_denied");

  const code = params.get("code");
  const verifier = request.cookies.get(VK_VERIFIER_COOKIE)?.value;
  const expectedState = request.cookies.get(VK_STATE_COOKIE)?.value;

  if (!code || !verifier || !expectedState) return fail("vk");

  // Проверяем, что вернулись именно с нашего запроса: иначе чужой ссылкой
  // можно было бы втянуть человека в вход под посторонним аккаунтом.
  if (params.get("state") !== expectedState) return fail("vk");

  const identity = await exchangeCode(
    code,
    verifier,
    expectedState,
    params.get("device_id"),
  );

  if (!identity) return fail("vk");

  // Ищем сначала по ВК, потом по почте: человек мог завести аккаунт паролем,
  // а теперь войти через ВК с тем же адресом. Это один и тот же человек, и
  // плодить ему второй аккаунт незачем.
  const existing =
    (await prisma.user.findUnique({ where: { vkId: identity.vkId } })) ??
    (identity.email
      ? await prisma.user.findUnique({ where: { email: identity.email } })
      : null);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          vkId: identity.vkId,
          name: existing.name ?? identity.name,
          avatarUrl: identity.avatarUrl ?? existing.avatarUrl,
          // Вход через ВК подтверждает, что человек владеет аккаунтом, так
          // что письмо с кодом ему больше не нужно.
          emailConfirmedAt: existing.emailConfirmedAt ?? new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          vkId: identity.vkId,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          emailConfirmedAt: new Date(),
        },
      });

  await createSession(user.id);

  const response = NextResponse.redirect(`${SITE_URL}/search`);
  response.cookies.delete(VK_VERIFIER_COOKIE);
  response.cookies.delete(VK_STATE_COOKIE);
  return response;
}
