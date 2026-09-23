"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export interface ProfileCardData {
  id: string;
  name: string;
  gender: string | null;
  age: number | null;
  relationship: string | null;
  job: string | null;
  interests: string | null;
}

interface ProfileCardProps {
  profile: ProfileCardData;
  /** Сколько подборов сделано для этого получателя — нужно для предупреждения при удалении. */
  searchCount: number;
  /** История подборов, отрисованная на сервере. */
  children?: ReactNode;
}

const inputClass =
  "rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";
const labelClass = "text-xs font-medium text-muted-foreground";

export default function ProfileCard({
  profile,
  searchCount,
  children,
}: ProfileCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender ?? "");
  const [age, setAge] = useState(profile.age?.toString() ?? "");
  const [relationship, setRelationship] = useState(profile.relationship ?? "");
  const [job, setJob] = useState(profile.job ?? "");
  const [interests, setInterests] = useState(profile.interests ?? "");

  function cancel() {
    // Возвращаем поля к сохранённым значениям, иначе при повторном открытии
    // формы человек увидит свою же брошенную правку и решит, что она сохранилась.
    setName(profile.name);
    setGender(profile.gender ?? "");
    setAge(profile.age?.toString() ?? "");
    setRelationship(profile.relationship ?? "");
    setJob(profile.job ?? "");
    setInterests(profile.interests ?? "");
    setError(null);
    setEditing(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // null, а не undefined: очищенное поле должно стираться в базе,
          // иначе стереть однажды заполненный интерес будет невозможно.
          gender: gender || null,
          age: age ? Number(age) : null,
          relationship: relationship.trim() || null,
          job: job.trim() || null,
          interests: interests.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const warning =
      searchCount > 0
        ? `Удалить получателя «${profile.name}»? Вместе с ним удалится история подборов — ${searchCount} шт. Отменить это будет нельзя.`
        : `Удалить получателя «${profile.name}»?`;

    if (!confirm(warning)) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось удалить");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-5 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`name-${profile.id}`} className={labelClass}>
            Как называем получателя
          </label>
          <input
            id={`name-${profile.id}`}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`gender-${profile.id}`} className={labelClass}>
              Пол
            </label>
            <select
              id={`gender-${profile.id}`}
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="">Не важно</option>
              <option value="female">Женский</option>
              <option value="male">Мужской</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`age-${profile.id}`} className={labelClass}>
              Возраст
            </label>
            <input
              id={`age-${profile.id}`}
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`rel-${profile.id}`} className={labelClass}>
            Кем приходится
          </label>
          <input
            id={`rel-${profile.id}`}
            placeholder="мама, коллега, друг…"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`job-${profile.id}`} className={labelClass}>
            Профессия / род занятий
          </label>
          <input
            id={`job-${profile.id}`}
            value={job}
            onChange={(e) => setJob(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`int-${profile.id}`} className={labelClass}>
            Увлечения и интересы
          </label>
          <textarea
            id={`int-${profile.id}`}
            rows={2}
            placeholder="садоводство, сериалы, путешествия…"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="gradient-brand rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={loading}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold">{profile.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {[profile.relationship, profile.age ? `${profile.age} лет` : null]
              .filter(Boolean)
              .join(" · ") || "Нет дополнительных данных"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/search?profileId=${profile.id}`}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Подобрать
          </Link>
          <button
            onClick={() => setEditing(true)}
            aria-label="Изменить получателя"
            title="Изменить"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            ✎
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            aria-label="Удалить получателя"
            title="Удалить"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          {error}
        </p>
      )}

      {children}
    </div>
  );
}
