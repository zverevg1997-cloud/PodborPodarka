"use client";

import type { ReactNode } from "react";
import { reachGoal, type GoalName } from "@/lib/metrika";

/**
 * Внешняя ссылка, клик по которой уходит в Метрику.
 *
 * То же, что GiftLink, но без навязанного вида: здесь внутри карточка с
 * картинкой и ценой, а не строка текста.
 */
export default function TrackedLink({
  href,
  goal,
  params,
  className,
  children,
}: {
  href: string;
  goal: GoalName;
  params?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => reachGoal(goal, params)}
      className={className}
    >
      {children}
    </a>
  );
}
