"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import RecommendLoader from "@/components/RecommendLoader";
import { GOALS, reachGoal } from "@/lib/metrika";

interface Profile {
  id: string;
  name: string;
  gender: string | null;
  age: number | null;
  relationship: string | null;
  job: string | null;
  interests: string | null;
}

const NEW_PROFILE = "__new__";

const inputClass =
  "rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

const labelClass = "text-sm font-medium text-foreground/80";

const MOOD_PAIRS = [
  ["Шуточный", "Серьёзный"],
  ["Романтичный", "Практичный"],
  ["Скромный", "Роскошный"],
  ["Классический", "Необычный"],
];

const PREDEFINED_MOODS = MOOD_PAIRS.flat();

function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(NEW_PROFILE);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [relationship, setRelationship] = useState("");
  const [job, setJob] = useState("");
  const [interests, setInterests] = useState("");

  const [occasion, setOccasion] = useState("");
  const [budget, setBudget] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [city, setCity] = useState("");
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [customMood, setCustomMood] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => {
        const list: Profile[] = data.profiles ?? [];
        setProfiles(list);

        const preselect = searchParams.get("profileId");
        if (preselect && list.some((p) => p.id === preselect)) {
          setSelectedProfileId(preselect);
        } else if (list.length === 0) {
          setSelectedProfileId(NEW_PROFILE);
        }
      })
      .finally(() => setProfilesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMood(tag: string) {
    setSelectedMoods((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomMood() {
    const tag = customMood.trim();
    if (!tag || selectedMoods.includes(tag)) {
      setCustomMood("");
      return;
    }
    setSelectedMoods((prev) => [...prev, tag]);
    setCustomMood("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!occasion) {
      setError("Укажите повод для подарка");
      return;
    }
    if (selectedProfileId === NEW_PROFILE && !name) {
      setError("Укажите имя получателя");
      return;
    }

    setLoading(true);

    let profileId = selectedProfileId;

    if (selectedProfileId === NEW_PROFILE) {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gender: gender || undefined,
          age: age ? Number(age) : undefined,
          relationship: relationship || undefined,
          job: job || undefined,
          interests: interests || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить профиль получателя");
        setLoading(false);
        return;
      }
      profileId = data.profile.id;
    }

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        occasion,
        budget: budget || undefined,
        timeframe: timeframe || undefined,
        city: city || undefined,
        mood: selectedMoods.length > 0 ? selectedMoods.join(", ") : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Не удалось подобрать подарок");
      setLoading(false);
      return;
    }

    // Цель отправляем здесь, а не на странице результатов: туда можно попасть
    // и из истории, и такие заходы не должны считаться новыми подборами.
    reachGoal(GOALS.recommendDone, { ideas: data.ideas?.length ?? 0 });

    // loading не сбрасываем: индикатор должен остаться до перехода на /results.
    router.push(`/results?searchId=${data.searchId}`);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12">
      {loading && <RecommendLoader />}

      <div className="text-center sm:text-left">
        <span className="text-3xl">🎁</span>
        <h1 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">
          Подобрать подарок
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расскажите немного о получателе и поводе — предложим несколько идей.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-full text-sm">
              👤
            </span>
            <h2 className="font-display text-sm font-bold">Кому дарим</h2>
          </div>

          {!profilesLoading && profiles.length > 0 && (
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className={inputClass}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PROFILE}>+ Новый получатель</option>
            </select>
          )}

          {selectedProfileId === NEW_PROFILE && (
            <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className={labelClass}>
                  Имя или как вы его называете *
                </label>
                <input
                  id="name"
                  placeholder="Мама / Коллега Андрей"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="gender" className={labelClass}>
                    Пол
                  </label>
                  <select
                    id="gender"
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
                  <label htmlFor="age" className={labelClass}>
                    Возраст
                  </label>
                  <input
                    id="age"
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
                <label htmlFor="relationship" className={labelClass}>
                  Кем приходится
                </label>
                <input
                  id="relationship"
                  placeholder="мама, коллега, друг…"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="job" className={labelClass}>
                  Профессия / род занятий
                </label>
                <input
                  id="job"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="interests" className={labelClass}>
                  Увлечения и интересы
                </label>
                <textarea
                  id="interests"
                  rows={2}
                  placeholder="садоводство, сериалы, путешествия…"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-full text-sm">
              🎉
            </span>
            <h2 className="font-display text-sm font-bold">
              Повод и условия
            </h2>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="occasion" className={labelClass}>
              Повод *
            </label>
            <input
              id="occasion"
              placeholder="День рождения, Новый год…"
              required
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="budget" className={labelClass}>
                Бюджет
              </label>
              <input
                id="budget"
                placeholder="до 3000 ₽"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="timeframe" className={labelClass}>
                Когда нужен
              </label>
              <input
                id="timeframe"
                placeholder="завтра / через неделю"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="city" className={labelClass}>
              Город
            </label>
            <input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>
              Дух подарка{" "}
              <span className="font-normal text-muted-foreground">
                (можно выбрать несколько)
              </span>
            </span>

            <div className="flex flex-col gap-2">
              {MOOD_PAIRS.map((pair) => (
                <div key={pair.join("-")} className="flex flex-wrap gap-2">
                  {pair.map((tag) => {
                    const active = selectedMoods.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleMood(tag)}
                        aria-pressed={active}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                          active
                            ? "gradient-brand border-transparent text-primary-foreground shadow-sm"
                            : "border-border text-foreground/80 hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {selectedMoods.some((m) => !PREDEFINED_MOODS.includes(m)) && (
              <div className="flex flex-wrap gap-2">
                {selectedMoods
                  .filter((m) => !PREDEFINED_MOODS.includes(m))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMood(tag)}
                      className="gradient-brand flex items-center gap-1.5 rounded-full border border-transparent px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-sm"
                    >
                      {tag} <span aria-hidden>✕</span>
                    </button>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                placeholder="Свой вариант…"
                value={customMood}
                onChange={(e) => setCustomMood(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomMood();
                  }
                }}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={addCustomMood}
                className="rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
              >
                Добавить
              </button>
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="gradient-brand rounded-full px-4 py-3 text-base font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Подбираем…" : "Подобрать идеи подарка ✨"}
        </button>
      </form>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchForm />
    </Suspense>
  );
}
