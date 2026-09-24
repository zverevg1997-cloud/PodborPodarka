import { getSessionUser } from "@/lib/session";

/**
 * Текущий авторизованный пользователь (или null) — для серверных компонентов
 * и обработчиков маршрутов. Раньше за этим ходили в Supabase Auth, теперь
 * сессия своя и лежит в нашей же базе.
 */
export async function getCurrentUser() {
  return getSessionUser();
}
