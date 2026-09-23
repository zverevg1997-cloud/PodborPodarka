"use client";

import type { ReactNode } from "react";

interface LoadingOverlayProps {
  title: string;
  icon?: string;
  /** Пояснение под заголовком: у подбора оно меняется по ходу дела. */
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Перекрытие на время долгой операции. Кроме собственно индикации оно решает
 * вторую задачу: пока оно на экране, по форме нельзя кликнуть повторно.
 */
export default function LoadingOverlay({
  title,
  icon = "🎁",
  children,
  footer,
}: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" />
          <span className="animate-pulse text-2xl motion-reduce:animate-none">
            {icon}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-display text-base font-bold">{title}</p>
          {children}
        </div>

        {footer}
      </div>
    </div>
  );
}
