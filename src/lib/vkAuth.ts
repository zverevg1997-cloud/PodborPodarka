/**
 * Вход через ВКонтакте (VK ID).
 *
 * Старый способ — «получить токен прямо в адресной строке» — ВК закрыл.
 * Теперь так: браузер приносит одноразовый код, а меняем его на токен мы
 * сами, на сервере, предъявляя секрет, который придумали в начале и никуда
 * не показывали. Перехват кода без этого секрета бесполезен.
 *
 * Поэтому у входа две половины: `/api/auth/vk/start` придумывает секрет и
 * уводит человека во ВКонтакте, `/api/auth/vk/callback` принимает его
 * обратно. Между ними состояние живёт в короткоживущих куках — своего
 * хранилища на десять минут заводить незачем.
 */

import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";

const ID_BASE = "https://id.vk.com";

/** Что просим у человека: только то, что показываем в профиле. */
const SCOPE = "email";

export const VK_VERIFIER_COOKIE = "vk_verifier";
export const VK_STATE_COOKIE = "vk_state";

/** Куки живут ровно столько, сколько человек тратит на страницу согласия. */
export const VK_COOKIE_TTL_SECONDS = 600;

export function isVkLoginConfigured(): boolean {
  return Boolean(process.env.VK_APP_ID);
}

export function vkRedirectUri(): string {
  return `${SITE_URL}/api/auth/vk/callback`;
}

const base64url = (buffer: Buffer) => buffer.toString("base64url");

export function createChallenge(): {
  verifier: string;
  challenge: string;
  state: string;
} {
  const verifier = base64url(randomBytes(48));
  return {
    verifier,
    challenge: base64url(createHash("sha256").update(verifier).digest()),
    state: base64url(randomBytes(12)),
  };
}

export function authorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.VK_APP_ID ?? "",
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: vkRedirectUri(),
    state,
    scope: SCOPE,
  });

  return `${ID_BASE}/authorize?${params}`;
}

export interface VkIdentity {
  vkId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

async function post(path: string, body: Record<string, string>) {
  const res = await fetch(`${ID_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(20_000),
  });

  return (await res.json()) as Record<string, unknown>;
}

/**
 * Меняет код на токен и узнаёт, кто пришёл.
 *
 * Возвращает null на любой неудаче: разбирать на стороне вызова десять
 * разных ответов ВК незачем, исход у всех один — вход не состоялся.
 */
export async function exchangeCode(
  code: string,
  verifier: string,
  state: string,
  deviceId: string | null,
): Promise<VkIdentity | null> {
  const secret = process.env.VK_APP_SECRET;

  const token = await post("/oauth2/auth", {
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: process.env.VK_APP_ID ?? "",
    redirect_uri: vkRedirectUri(),
    state,
    ...(deviceId ? { device_id: deviceId } : {}),
    // Приложение может быть заведено и как доверенное, и как открытое.
    // У открытого секрета нет вовсе, и посылать пустую строку нельзя.
    ...(secret ? { client_secret: secret } : {}),
  });

  const accessToken = token.access_token;
  if (typeof accessToken !== "string") {
    console.error("вк: обмен кода не удался", JSON.stringify(token).slice(0, 300));
    return null;
  }

  const info = await post("/oauth2/user_info", {
    client_id: process.env.VK_APP_ID ?? "",
    access_token: accessToken,
  });

  const user = info.user as
    | { user_id?: string | number; first_name?: string; last_name?: string; email?: string; avatar?: string }
    | undefined;

  if (!user?.user_id) {
    console.error("вк: не узнали пользователя", JSON.stringify(info).slice(0, 300));
    return null;
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  return {
    vkId: String(user.user_id),
    name: name || null,
    email: user.email?.trim().toLowerCase() || null,
    avatarUrl: user.avatar || null,
  };
}
