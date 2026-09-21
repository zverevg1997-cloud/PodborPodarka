import { createClient } from "@/lib/supabase/server";

/**
 * Текущий авторизованный пользователь Supabase Auth (или null),
 * для использования в Server Components и Route Handlers.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
