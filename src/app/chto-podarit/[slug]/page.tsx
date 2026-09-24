import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GiftLink from "@/components/GiftLink";
import { GIFT_GUIDES, findGuide, type GuideIdea } from "@/lib/giftGuides";

export function generateStaticParams() {
  return GIFT_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/chto-podarit/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);

  if (!guide) return {};

  return {
    // Заголовок дословно повторяет поисковый запрос — по нему страницу и ищут.
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/chto-podarit/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description },
  };
}

function IdeaCard({ idea }: { idea: GuideIdea }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-display text-base font-bold">{idea.name}</h3>
      <p className="text-sm text-muted-foreground">{idea.reason}</p>
      <span className="text-xs font-medium text-muted-foreground">
        примерно {idea.priceFrom.toLocaleString("ru")}–
        {idea.priceTo.toLocaleString("ru")} ₽
      </span>
      <GiftLink
        href={`/api/market-link?q=${encodeURIComponent(idea.searchQuery)}&from=${idea.priceFrom}&to=${idea.priceTo}`}
        label="Посмотреть на Яндекс Маркете →"
        kind="product"
        query={idea.searchQuery}
      />
    </div>
  );
}

export default async function GuidePage({
  params,
}: PageProps<"/chto-podarit/[slug]">) {
  const { slug } = await params;
  const guide = findGuide(slug);

  if (!guide) notFound();

  const others = GIFT_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 6);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {guide.title}
        </h1>
        <p className="text-lg text-muted-foreground">{guide.intro}</p>
      </header>

      {/* Своё мнение о выборе — то, чего нет в списках конкурентов, и то,
          ради чего человек задерживается на странице, а не уходит обратно
          в поиск. Поведение на странице Яндекс учитывает сильнее текста. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
        <h2 className="font-display text-base font-bold">На что смотреть</h2>
        <ul className="flex flex-col gap-2">
          {guide.notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm text-muted-foreground">
              <span aria-hidden>•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">
          {guide.ideas.length} идей подарка
        </h2>
        <div className="flex flex-col gap-3">
          {guide.ideas.map((idea) => (
            <IdeaCard key={idea.name} idea={idea} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">
          {guide.budget.title}
        </h2>
        <p className="text-sm text-muted-foreground">{guide.budget.note}</p>
        <div className="flex flex-col gap-3">
          {guide.budget.ideas.map((idea) => (
            <IdeaCard key={idea.name} idea={idea} />
          ))}
        </div>
      </section>

      {/* Ради этого блока страница и существует: список идей есть у всех,
          подбор под конкретного ребёнка — только у нас. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
        <h2 className="font-display text-lg font-bold">
          Ничего не подошло?
        </h2>
        <p className="text-sm text-muted-foreground">{guide.cta}</p>
        <Link
          href="/search"
          className="gradient-brand mx-auto rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
        >
          Подобрать подарок 🎁
        </Link>
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="font-display text-base font-bold">Другие подборки</h2>
          <div className="flex flex-wrap gap-2">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/chto-podarit/${other.slug}`}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
              >
                {other.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
