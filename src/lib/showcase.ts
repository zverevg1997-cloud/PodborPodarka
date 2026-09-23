import { prisma } from "@/lib/prisma";
import type { GiftIdea } from "@/lib/types";

export interface ShowcaseIdea {
  name: string;
  kind: "product" | "local";
}

/** Запасные примеры на случай, если настоящих подборов ещё нет. */
const FALLBACK: ShowcaseIdea[] = [
  { name: "Беспроводные наушники с шумоподавлением", kind: "product" },
  { name: "Сертификат на посещение бани", kind: "local" },
  { name: "Набор для заваривания кофе", kind: "product" },
  { name: "Мастер-класс по гончарному делу", kind: "local" },
];

/**
 * Идеи из недавних подборов — для витрины на главной.
 *
 * Показываем только название и тип. Ни имени получателя, ни повода, ни
 * города: это сведения о конкретном человеке, и выносить их на главную
 * страницу мы права не имеем. Название подарка обезличено.
 */
export async function getShowcaseIdeas(limit = 4): Promise<ShowcaseIdea[]> {
  try {
    const searches = await prisma.search.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { resultJson: true },
    });

    const seen = new Set<string>();
    const ideas: ShowcaseIdea[] = [];

    for (const search of searches) {
      const parsed = (search.resultJson as unknown as GiftIdea[] | null) ?? [];
      for (const idea of parsed) {
        const name = idea.name?.trim();
        if (!name) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        ideas.push({ name, kind: idea.kind === "local" ? "local" : "product" });
        if (ideas.length >= limit) return ideas;
      }
    }

    // Пока подборов мало, дополняем запасными, чтобы витрина не была дырявой.
    return [...ideas, ...FALLBACK].slice(0, limit);
  } catch {
    // Витрина — украшение. Если база недоступна, главная всё равно должна
    // открыться, поэтому ошибку глотаем и показываем запасные примеры.
    return FALLBACK.slice(0, limit);
  }
}
