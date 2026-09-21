"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Изучаем анкету получателя…",
  "Перебираем подходящие варианты…",
  "Проверяем, что укладываемся в бюджет…",
  "Готовим обоснования…",
  "Почти готово…",
];

export default function RecommendLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 2800);
    return () => clearInterval(timer);
  }, []);

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
            🎁
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-display text-base font-bold">
            Подбираем подарок
          </p>
          <p className="text-sm text-muted-foreground">{STEPS[step]}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Обычно занимает 10–15 секунд
        </p>
      </div>
    </div>
  );
}
