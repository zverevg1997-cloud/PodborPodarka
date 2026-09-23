import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const STEPS = [
  {
    emoji: "📝",
    title: "Заполните анкету",
    text: "Кому дарим, по какому поводу, какой бюджет и сколько есть времени.",
  },
  {
    emoji: "🤖",
    title: "ИИ подбирает идеи",
    text: "Бот анализирует данные о получателе и предлагает несколько вариантов.",
  },
  {
    emoji: "🎯",
    title: "Выбираете лучшую",
    text: "У каждой идеи — понятное объяснение, почему она подойдёт именно ему.",
  },
];

const EXAMPLE_IDEAS = [
  { emoji: "🎧", name: "Беспроводные наушники", tag: "Универсально" },
  { emoji: "🧖", name: "Сертификат в SPA", tag: "Для отдыха" },
  { emoji: "☕", name: "Набор для кофе", tag: "Для дома" },
  { emoji: "🧣", name: "Плед с вышивкой", tag: "С душой" },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 right-[-8rem] h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-96 left-[-6rem] h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <section className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center sm:pt-28">
        <span className="rounded-full bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
          Дарить приятно, когда не мучаешься с выбором
        </span>
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Дарить <span className="gradient-brand-text">точно в цель</span> —
          <br className="hidden sm:block" /> за пару минут
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Расскажите, кому и по какому поводу нужен подарок — Daribot
          предложит несколько идей с объяснением, почему они подойдут.
        </p>
        <Link
          href="/search"
          className="gradient-brand rounded-full px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:opacity-90 active:scale-95"
        >
          Подобрать подарок 🎁
        </Link>

        {/* Главный довод для того, кто зашёл впервые: пробовать можно сразу.
            Раньше кнопка вела его на регистрацию, и это сводило на нет весь
            смысл бесплатного первого подбора. */}
        {!user && (
          <p className="-mt-2 text-sm font-medium text-muted-foreground">
            Первый подбор — без регистрации
          </p>
        )}
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="gradient-brand mb-4 flex h-11 w-11 items-center justify-center rounded-full text-xl">
                {step.emoji}
              </div>
              <h3 className="font-display text-base font-bold">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
          Примеры идей, которые предлагает Daribot
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLE_IDEAS.map((idea) => (
            <div
              key={idea.name}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-3xl">{idea.emoji}</span>
              <span className="font-display text-sm font-bold">
                {idea.name}
              </span>
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {idea.tag}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
