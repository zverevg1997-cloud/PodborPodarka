import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-клиент для использования в клиентских компонентах ("use client").
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
