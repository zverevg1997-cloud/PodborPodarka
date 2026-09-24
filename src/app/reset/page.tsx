"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

const inputClass =
  "rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

const buttonClass =
  "gradient-brand mt-2 rounded-full px-4 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50";

export default function ResetPage() {
  const router = useRouter();

  // Шаг «code» начинается после отправки письма. Отдельной страницы под него
  // не делаем: человек должен видеть, на какой адрес пришёл код.
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить письмо");
        return;
      }

      setStep("code");
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось сменить пароль");
        setLoading(false);
        return;
      }

      // Новый пароль сразу даёт сессию — вводить его ещё раз не нужно.
      router.push("/search");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      {loading && (
        <LoadingOverlay
          title={step === "email" ? "Отправляем письмо…" : "Меняем пароль…"}
          icon="🔑"
        />
      )}

      <div className="text-center">
        <span className="text-3xl">🔑</span>
        <h1 className="font-display mt-2 text-2xl font-extrabold">
          Восстановление пароля
        </h1>
      </div>

      {step === "email" ? (
        <form
          onSubmit={handleRequest}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">
            Укажите почту, на которую зарегистрирован аккаунт — пришлём код для
            смены пароля.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Отправляем…" : "Прислать код"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleReset}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">
            Если аккаунт с адресом {email} существует, код уже отправлен.
            Письмо приходит в течение минуты — проверьте и папку со спамом.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="code" className="text-sm font-medium">
              Код из письма
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} text-center text-lg tracking-[0.4em]`}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Новый пароль
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Меняем…" : "Сменить пароль"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
            className="text-sm text-muted-foreground transition hover:text-primary"
          >
            Указать другой адрес
          </button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Вспомнили пароль?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
