import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-клиент для использования в Server Components, Route Handlers
 * и Server Actions. Работает с cookies текущего запроса, поэтому знает,
 * авторизован ли пользователь.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll вызывается из Server Component, где нет доступа к записи
            // cookies — сессия в этом случае обновляется в middleware.
          }
        },
      },
    },
  );
}
