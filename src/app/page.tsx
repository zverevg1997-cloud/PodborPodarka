import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getShowcaseIdeas } from "@/lib/showcase";
import { GIFT_GUIDES } from "@/lib/giftGuides";
import { botLink } from "@/lib/site";

// У главной несколько входов: апекс, www и второй домен. Канонический адрес
// говорит поисковику, какой из них считать основным, иначе он видит
// несколько одинаковых сайтов и делит между ними вес.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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

const PARAMETERS = [
  {
    title: "Кому дарим",
    text: "Возраст, пол, кем приходится. Подарок коллеге и подарок сестре не пересекаются, даже если обеим тридцать.",
  },
  {
    title: "Увлечения и работа",
    text: "Главный источник неочевидных идей: именно отсюда берётся то, что человек не купил бы себе сам.",
  },
  {
    title: "Повод",
    text: "Круглая дата, свадьба или повышение требуют более весомого подарка, чем рядовой день рождения.",
  },
  {
    title: "Бюджет",
    text: "Границы уходят в поиск по магазинам, поэтому в выдаче не будет ни грошовых вариантов, ни того, что вам не по карману.",
  },
  {
    title: "Срок",
    text: "Если подарок нужен сегодня, сервис ведёт в магазины вашего города, а не на маркетплейс с доставкой за неделю.",
  },
  {
    title: "Город",
    text: "Нужен для впечатлений и услуг: сертификаты, мастер-классы и экскурсии ищутся рядом с вами.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  // Настоящие идеи из недавних подборов вместо придуманных при вёрстке.
  const showcase = await getShowcaseIdeas();

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
          Подбор подарков,
          <br className="hidden sm:block" /> которые попадают{" "}
          <span className="gradient-brand-text">точно в цель</span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Расскажите, кому и по какому поводу нужен подарок — Дарибот
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

        <a
          href={botLink("site")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Или спросите бота в Телеграме →
        </a>
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

      <section className="relative mx-auto max-w-5xl px-6 pb-20">
        <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
          Подбор подарков по параметрам
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Сервис спрашивает не только про повод и сумму. Чем точнее ответы, тем
          меньше в подборке очевидного — а очевидное вы и сами уже придумали.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARAMETERS.map((parameter) => (
            <div
              key={parameter.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="font-display text-base font-bold">
                {parameter.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {parameter.text}
              </p>
            </div>
          ))}
        </div>
      </section>


      <section className="relative mx-auto max-w-5xl px-6 pb-20">
        <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
          Готовые подборки
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Если до анкеты пока не дошли — посмотрите идеи по поводу и получателю.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {GIFT_GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/chto-podarit/${guide.slug}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
            >
              {guide.title.split(":")[0]}
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/chto-podarit"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Все подборки →
          </Link>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
          Что Дарибот предлагал на днях
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {showcase.map((idea) => (
            <div
              key={idea.name}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-3xl">
                {idea.kind === "local" ? "✨" : "🎁"}
              </span>
              <span className="font-display text-sm font-bold">
                {idea.name}
              </span>
              <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {idea.kind === "local" ? "Впечатление" : "Товар"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
