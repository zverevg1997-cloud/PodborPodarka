/**
 * Где в подборках есть настоящие товары, а где нет.
 *
 * Фразы для поиска (`productQuery`) писались руками под каталог в тридцать
 * тысяч товаров и проверялись глазами. Каталог вырос вдвое и другим по
 * составу — появились книги, игрушки, настолки, — и оба края этого сдвига
 * стоит увидеть:
 *
 *  — какие фразы перестали находить хоть что-то (товар ушёл из выгрузки);
 *  — у каких идей фразы нет, а товар для них теперь, похоже, есть.
 *
 * Второе — список кандидатов, а не руководство к действию. Фразу всё равно
 * пишет человек и проверяет глазами: «настольная игра» и «настольная лампа»
 * различаются одним словом, и машина тут не помощник.
 */

import { GIFT_GUIDES, type GuideIdea } from "@/lib/giftGuides";
import { findProducts } from "@/lib/products/match";

export interface Coverage {
  /** Фразы заданы, и товар по ним находится. */
  filled: number;
  /** Фразы заданы, но товара по ним больше нет. */
  empty: { slug: string; idea: string; query: string }[];
  /** Идей без фразы всего. */
  without: number;
  /** Из них те, под которые товар, похоже, есть. */
  candidates: { slug: string; idea: string; query: string; found: number }[];
}

/**
 * Из чего пробовать искать, когда фразы нет.
 *
 * Берём первые два слова поисковой фразы для Маркета. Она написана для
 * другого поиска — там лишние слова только уточняют, — но начинается почти
 * всегда с самого предмета: «настольная игра для компании», «термокружка
 * нержавеющая сталь». Дальше идут подробности, которых в названии товара
 * может и не быть.
 */
function guess(idea: GuideIdea): string | null {
  const words = idea.searchQuery.split(/\s+/).filter((w) => w.length >= 3);
  return words.length >= 2 ? words.slice(0, 2).join(" ") : (words[0] ?? null);
}

export async function coverage(): Promise<Coverage> {
  const out: Coverage = { filled: 0, empty: [], without: 0, candidates: [] };

  for (const guide of GIFT_GUIDES) {
    const ideas = [...guide.ideas, ...(guide.budget?.ideas ?? [])];

    for (const idea of ideas) {
      if (idea.productQuery) {
        const found = await findProducts(idea.productQuery, idea.priceFrom, idea.priceTo);
        if (found.length > 0) out.filled++;
        else out.empty.push({ slug: guide.slug, idea: idea.name, query: idea.productQuery });
        continue;
      }

      out.without++;

      const query = guess(idea);
      if (!query) continue;

      const found = await findProducts(query, idea.priceFrom, idea.priceTo);
      if (found.length > 0) {
        out.candidates.push({
          slug: guide.slug,
          idea: idea.name,
          query,
          found: found.length,
        });
      }
    }
  }

  return out;
}
