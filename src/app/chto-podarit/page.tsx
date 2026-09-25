import type { Metadata } from "next";
import Link from "next/link";
import { GIFT_GUIDES } from "@/lib/giftGuides";
import { botLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Что подарить — подборки по возрасту и поводу",
  description:
    "Подборки идей подарков с объяснением, почему каждая подойдёт. " +
    "По возрасту получателя и поводу.",
  alternates: { canonical: "/chto-podarit" },
};

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-extrabold">Что подарить</h1>
        <p className="text-muted-foreground">
          Готовые подборки по возрасту и поводу. У каждой идеи — объяснение,
          почему она подойдёт, и ссылка, где посмотреть цены.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {GIFT_GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={`/chto-podarit/${guide.slug}`}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="font-display text-base font-bold">
              {guide.title}
            </span>
            <span className="text-sm text-muted-foreground">
              {guide.description}
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
        <p className="font-display text-base font-bold">
          Нужен подарок конкретному человеку?
        </p>
        <p className="text-sm text-muted-foreground">
          Заполните короткую анкету — Дарибот предложит идеи под него, а не под
          возраст вообще. Первый подбор без регистрации.
        </p>
        <div className="mx-auto flex flex-col gap-2 sm:flex-row">
          <Link
            href="/search"
            className="gradient-brand rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
          >
            Подобрать подарок 🎁
          </Link>
          <a
            href={botLink("guides-index")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Спросить бота в Телеграме
          </a>
        </div>
      </div>
    </div>
  );
}
