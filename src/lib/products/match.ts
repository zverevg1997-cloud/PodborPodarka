/**
 * Подбор товаров из партнёрских выгрузок под идею из подборки.
 *
 * Правило одно и оно строгое: **все** слова заданной фразы должны найтись в
 * названии товара, и цена должна попасть в вилку идеи.
 *
 * Строгость не от перестраховки. При мягком поиске каталог отвечает на
 * «настольную игру» настольной лампой, на «мешок для сменной обуви» —
 * сменным ремешком, а на «железную дорогу» — сертификатом в музей железных
 * дорог. Всё это настоящие совпадения по общему слову, и все три никуда не
 * годятся: читатель видит под идеей не то, что обещано.
 *
 * Ищем при каждой отрисовке страницы, без кэша. Кэш тут и не включить:
 * корневой макет читает куки ради имени в шапке, из-за чего все страницы
 * сайта динамические. Но запрос дешёвый — отбор идёт по индексу цены на
 * десяти тысячах строк, — так что городить обходной путь не из-за чего.
 *
 * Поэтому фразу для поиска задаёт человек, отдельным полем у идеи, и только
 * там, где в каталоге действительно что-то есть. Где фразы нет — страница
 * по-прежнему ведёт на поиск Яндекс Маркета.
 */

import { prisma } from "@/lib/prisma";
import type { Product } from "@prisma/client";

/** Сколько карточек показываем под одной идеей. */
const LIMIT = 3;

/**
 * Русские слова склоняются, а названия в выгрузках пишут как придётся.
 * Отрезаем окончание — этого хватает, чтобы «кружка» нашла «кружки».
 * Настоящая лемматизация тут была бы стрельбой из пушки.
 */
function stem(word: string): string {
  return word.replace(/(ами|ями|ов|ей|ам|ям|ах|ях|ой|ую|ые|ий|ая|ое|ы|и|а|я|у|ю|е)$/u, "");
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .map(stem);
}

export async function findProducts(
  query: string,
  priceFrom: number,
  priceTo: number,
): Promise<Product[]> {
  const needed = words(query);
  if (needed.length === 0) return [];

  // Отбираем по цене и по первому слову в базе, остальное досеиваем здесь:
  // сравнивать основы слов средствами Postgres пришлось бы через отдельный
  // словарь, а товаров в вилке всегда немного.
  const candidates = await prisma.product.findMany({
    where: {
      available: true,
      price: { gte: priceFrom, lte: priceTo },
      name: { contains: needed[0], mode: "insensitive" },
    },
    orderBy: { price: "asc" },
    take: 200,
  });

  const seen = new Set<string>();
  const matched: Product[] = [];

  for (const product of candidates) {
    const name = words(product.name).join(" ");
    if (!needed.every((word) => name.includes(word))) continue;

    // Один товар в пяти цветах — это одна идея, а не пять. Схлопываем по
    // названию: в выгрузках варианты называются одинаково.
    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    matched.push(product);
    if (matched.length === LIMIT) break;
  }

  return matched;
}
