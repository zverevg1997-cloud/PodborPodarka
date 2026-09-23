import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildYandexSearchUrl } from "@/lib/yandexMarket";
import MoreIdeasButton from "@/components/MoreIdeasButton";
import GiftLink from "@/components/GiftLink";
import { readGuestId } from "@/lib/guest";
import type { GiftIdea } from "@/lib/types";

interface ResultsPageProps {
  searchParams: Promise<{ searchId?: string }>;
}

const CARD_ACCENTS = ["bg-primary/10", "bg-secondary/10", "bg-accent/20"];
const CARD_EMOJI = ["🎁", "💡", "✨", "🌟"];

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <span className="text-4xl">🔍</span>
      <p className="mt-4 text-muted-foreground">{text}</p>
      <Link
        href="/search"
        className="gradient-brand mt-6 inline-block rounded-full px-6 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
      >
        Начать подбор подарка
      </Link>
    </div>
  );
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const { searchId } = await searchParams;
  const user = await getCurrentUser();
  const guestId = user ? null : await readGuestId();

  if (!user && !guestId) {
    redirect("/login");
  }

  if (!searchId) {
    return <EmptyState text="Результат не выбран." />;
  }

  // Результат виден либо владельцу аккаунта, либо гостю с той же кукой.
  const search = await prisma.search.findFirst({
    where: {
      id: searchId,
      profile: user ? { userId: user.id } : { guestId },
    },
    include: { profile: true },
  });

  if (!search) {
    return <EmptyState text="Результат не найден." />;
  }

  const ideas = (search.resultJson as unknown as GiftIdea[] | null) ?? [];

  const chips = [
    { label: "Повод", value: search.occasion },
    { label: "Бюджет", value: search.budget },
    { label: "Срок", value: search.timeframe },
    { label: "Город", value: search.city },
    { label: "Дух подарка", value: search.mood },
  ].filter((chip) => chip.value);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div className="text-center sm:text-left">
        <span className="text-3xl">🎉</span>
        <h1 className="font-display mt-2 text-2xl font-extrabold sm:text-3xl">
          Идеи подарка для {search.profile.name}
        </h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {ideas.map((idea, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`}
            >
              {CARD_EMOJI[i % CARD_EMOJI.length]}
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-display text-base font-bold">
                {idea.name}
              </h3>
              <p className="text-sm text-muted-foreground">{idea.reason}</p>
              <GiftLink
                href={
                  idea.kind === "local"
                    ? buildYandexSearchUrl(idea.searchQuery, search.city)
                    : `/api/market-link?q=${encodeURIComponent(idea.searchQuery)}`
                }
                kind={idea.kind === "local" ? "local" : "product"}
                query={idea.searchQuery}
                label={
                  idea.kind === "local"
                    ? search.city
                      ? `Найти в Яндексе: ${search.city} →`
                      : "Найти в Яндексе →"
                    : "Смотреть на Яндекс Маркете →"
                }
              />
            </div>
          </div>
        ))}
      </div>

      {!user && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-center">
          <p className="font-display text-base font-bold">
            Сохранить эти идеи?
          </p>
          <p className="text-sm text-muted-foreground">
            Зарегистрируйтесь — подборка останется в кабинете, а вы получите
            ещё пять подборов в день и возможность искать для других людей.
          </p>
          <Link
            href="/register"
            className="gradient-brand mx-auto rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
          >
            Создать аккаунт
          </Link>
        </div>
      )}

      {/* Гостю кнопку не показываем: его единственный бесплатный подбор уже
          потрачен, и нажатие привело бы к отказу. Вместо неё — предложение
          зарегистрироваться выше. */}
      {user && (
      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <p className="text-center text-sm text-muted-foreground">
          Ничего не подошло?
        </p>
        <MoreIdeasButton
          search={{
            id: search.id,
            profileId: search.profileId,
            occasion: search.occasion,
            budget: search.budget ?? undefined,
            timeframe: search.timeframe ?? undefined,
            city: search.city ?? undefined,
            mood: search.mood ?? undefined,
          }}
        />
      </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
        <Link
          href={`/search?profileId=${search.profileId}`}
          className="rounded-full border border-border px-4 py-2 font-medium transition hover:border-primary/40 hover:text-primary"
        >
          Подобрать ещё раз для {search.profile.name}
        </Link>
        <Link
          href="/profile"
          className="rounded-full border border-border px-4 py-2 font-medium transition hover:border-primary/40 hover:text-primary"
        >
          К истории поисков
        </Link>
      </div>
    </div>
  );
}
