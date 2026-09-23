"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface HeaderProps {
  userEmail: string | null;
  usedToday: number;
  dailyLimit: number;
}

export default function Header({
  userEmail,
  usedToday,
  dailyLimit,
}: HeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-sm shadow-primary/30">
            🎁
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Daribot
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          {userEmail ? (
            <>
              <Link
                href="/search"
                className="rounded-full px-2.5 py-2 font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground sm:px-3"
              >
                <span className="sm:hidden">Подобрать</span>
                <span className="hidden sm:inline">Подобрать подарок</span>
              </Link>
              <Link
                href="/profile"
                className="rounded-full px-2.5 py-2 font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground sm:px-3"
              >
                Кабинет
              </Link>
              {/* Счётчик показываем и на телефоне: человек должен понимать,
                  сколько подборов осталось, до того как нажмёт кнопку. */}
              <span
                title={`Подборов сегодня: ${usedToday} из ${dailyLimit}. Лимит обновляется в полночь по Москве.`}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  usedToday >= dailyLimit
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span aria-hidden>🎁</span>
                <span>
                  {Math.max(0, dailyLimit - usedToday)}
                  <span className="opacity-60">/{dailyLimit}</span>
                </span>
              </span>

              <span className="hidden max-w-[10rem] truncate text-muted-foreground md:inline">
                {userEmail}
              </span>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="rounded-full border border-border px-2.5 py-2 font-medium text-foreground/80 transition hover:border-primary/40 hover:text-primary disabled:opacity-50 sm:px-4"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="gradient-brand rounded-full px-4 py-2 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-95"
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
