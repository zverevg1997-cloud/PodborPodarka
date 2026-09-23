"use client";

import { useEffect, useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

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
    <LoadingOverlay
      title="Подбираем подарок"
      footer={
        <p className="text-xs text-muted-foreground">
          Обычно занимает 10–15 секунд
        </p>
      }
    >
      <p className="text-sm text-muted-foreground">{STEPS[step]}</p>
    </LoadingOverlay>
  );
}
