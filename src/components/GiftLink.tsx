"use client";

import { GOALS, reachGoal } from "@/lib/metrika";

interface GiftLinkProps {
  href: string;
  label: string;
  /** Что за идея: товар с маркетплейса или услуга. Попадёт в параметры цели. */
  kind: "product" | "local";
  query: string;
}

/**
 * Ссылка на идею подарка. Клик по ней — главное полезное действие сервиса:
 * именно он приносит партнёрское вознаграждение. Отдельный компонент нужен
 * только ради отправки цели, сама ссылка обычная.
 */
export default function GiftLink({ href, label, kind, query }: GiftLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => reachGoal(GOALS.giftClick, { kind, query })}
      className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline"
    >
      {label}
    </a>
  );
}
