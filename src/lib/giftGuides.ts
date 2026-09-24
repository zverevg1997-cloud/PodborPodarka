/**
 * Страницы-подборки под поисковые запросы: «что подарить мальчику на 10 лет»,
 * «что подарить коллегам на Новый год» и так далее.
 *
 * Идеи заданы заранее, а не генерируются при открытии: страница должна
 * открываться мгновенно и показывать роботу и человеку одно и то же. Подбор
 * под конкретного получателя живёт в анкете, ссылка на неё стоит на каждой
 * странице.
 *
 * Важно: страницы должны отличаться не только словом в заголовке. Если они
 * начнут повторять друг друга, поисковик сочтёт раздел штамповкой и понизит
 * сайт целиком. Поэтому каждая подборка пишется отдельно и лежит отдельным
 * файлом в `src/content/guides`.
 */

import { detyamNaNovyyGod } from "@/content/guides/detyam-na-novyy-god";
import { kollegamNaNovyyGod } from "@/content/guides/kollegam-na-novyy-god";
import { malchiku10Let } from "@/content/guides/malchiku-10-let";
import { mameNaNovyyGod } from "@/content/guides/mame-na-novyy-god";

export interface GuideIdea {
  name: string;
  /** Почему подойдёт. Этого нет в чужих списках, ради этого и остаются. */
  reason: string;
  /** Ориентировочная вилка, рублей. Точные цены показывает сам Маркет. */
  priceFrom: number;
  priceTo: number;
  /** Запрос, с которым уходим на Маркет. */
  searchQuery: string;
}

export interface GiftGuide {
  slug: string;
  /**
   * Заголовок и h1 — дословно так, как люди ищут, включая порядок слов.
   * «Что подарить мальчику на 10 лет» набирает 10 684, а «мальчику 10 лет на
   * день рождения» — вдвое меньше. Поэтому начинаем с сильной формы, а слабую
   * дописываем во второй половине: страница совпадает с обеими.
   */
  title: string;
  description: string;
  /** Вводный абзац: чем этот получатель или повод отличается от соседних. */
  intro: string;
  /** Короткие оговорки от себя — то, чего нет в чужих списках. */
  notes: string[];
  ideas: GuideIdea[];
  /** Бюджетный блок. Планка у подарка на класс и у подарка маме разная. */
  budget: {
    title: string;
    note: string;
    ideas: GuideIdea[];
  };
  /** Приглашение в анкету — про конкретного получателя, а не вообще. */
  cta: string;
}

export const GIFT_GUIDES: GiftGuide[] = [
  kollegamNaNovyyGod,
  detyamNaNovyyGod,
  mameNaNovyyGod,
  malchiku10Let,
];

export function findGuide(slug: string): GiftGuide | undefined {
  return GIFT_GUIDES.find((guide) => guide.slug === slug);
}
