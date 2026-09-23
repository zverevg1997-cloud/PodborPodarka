"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

const inputClass =
  "rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Всё внутри try/finally: если ответ окажется не JSON или оборвётся сеть,
    // без этого кнопка навсегда застревала в состоянии «Создаём аккаунт…».
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          phone: phone || undefined,
          acceptTerms,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось зарегистрироваться");
        return;
      }

      if (data.session) {
        router.push("/search");
        router.refresh();
      } else {
        setConfirmationSent(true);
      }
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Код неверный или устарел");
        return;
      }

      // verifyOtp сразу выдаёт сессию — входить отдельно не нужно.
      router.push("/search");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Не удалось отправить письмо");
      else setResent(true);
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-5 px-6 py-16">
        {loading && <LoadingOverlay title="Проверяем код…" icon="📬" />}

        <div className="text-center">
          <span className="text-4xl">📬</span>
          <h1 className="font-display mt-2 text-2xl font-extrabold">
            Введите код из письма
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Отправили код на {email}. Он действует час.
          </p>
        </div>

        <form
          onSubmit={handleConfirm}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="00000000"
            className="rounded-xl border border-border bg-background px-3.5 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
          />

          {error && (
            <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
              {error}
            </p>
          )}

          {resent && !error && (
            <p className="rounded-xl bg-secondary/10 px-4 py-2.5 text-sm font-medium text-secondary">
              Отправили новый код.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="gradient-brand rounded-full px-4 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Проверяем…" : "Подтвердить"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Письмо не пришло?{" "}
          <button
            onClick={handleResend}
            disabled={loading}
            className="font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Отправить ещё раз
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-16">
      {loading && (
        <LoadingOverlay title="Создаём аккаунт…">
          <p className="text-sm text-muted-foreground">
            Отправляем код на почту
          </p>
        </LoadingOverlay>
      )}

      <div className="text-center">
        <span className="text-3xl">🎁</span>
        <h1 className="font-display mt-2 text-2xl font-extrabold">
          Регистрация
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
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

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
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

        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">
            Телефон (необязательно)
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </div>

        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
          />
          <span>
            Я принимаю{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-semibold text-primary hover:underline"
            >
              пользовательское соглашение
            </Link>{" "}
            и даю согласие на обработку персональных данных в соответствии с{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="font-semibold text-primary hover:underline"
            >
              политикой конфиденциальности
            </Link>
            .
          </span>
        </label>

        {error && (
          <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !acceptTerms}
          className="gradient-brand mt-2 rounded-full px-4 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
