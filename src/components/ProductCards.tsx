import type { Product } from "@prisma/client";
import { GOALS } from "@/lib/metrika";
import TrackedLink from "@/components/TrackedLink";

/**
 * Карточки настоящих товаров под идеей из подборки.
 *
 * Показываются только там, где совпадение точное, — см. lib/products/match.
 * Там, где товара у нас нет, идея по-прежнему ведёт на поиск Маркета: лучше
 * отправить человека искать самому, чем показать не то.
 *
 * Ссылки в выгрузках Адмитада уже содержат erid, то есть промаркированы как
 * реклама самой сетью. Отдельно этим заниматься не нужно.
 */
export default function ProductCards({
  products,
  query,
}: {
  products: Product[];
  query: string;
}) {
  if (products.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {products.map((product) => (
        <TrackedLink
          key={product.id}
          href={product.url}
          goal={GOALS.giftClick}
          params={{ kind: "product", query }}
          className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 transition hover:border-primary/40"
        >
          {/* Картинки чужие и их тысячи, поэтому обычный img: через next/image
              каждая пошла бы через наш сервер и считалась в лимиты. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.picture}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />

          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{product.name}</span>
            <span className="text-sm font-semibold text-primary">
              {product.price.toLocaleString("ru")} ₽
              {product.oldPrice && product.oldPrice > product.price ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">
                  {product.oldPrice.toLocaleString("ru")} ₽
                </span>
              ) : null}
            </span>
          </span>
        </TrackedLink>
      ))}

      <span className="text-[11px] text-muted-foreground">Реклама</span>
    </div>
  );
}
