"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";
import { GOALS, reachGoal } from "@/lib/metrika";
import type { RecommendRequestBody } from "@/lib/types";

interface MoreIdeasButtonProps {
  search: RecommendRequestBody & { id: string };
}

export default function MoreIdeasButton({ search }: MoreIdeasButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: search.profileId,
          occasion: search.occasion,
          budget: search.budget,
          timeframe: search.timeframe,
          city: search.city,
          mood: search.mood,
          continueSearchId: search.id,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось подобрать ещё идеи");
        setLoading(false);
        return;
      }

      reachGoal(GOALS.moreIdeas);

      // Новый подбор содержит и прежние идеи, и новые, поэтому просто
      // переходим на него — страница покажет всё разом.
      router.replace(`/results?searchId=${data.searchId}`);
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && (
        <LoadingOverlay title="Ищем другие идеи" icon="💡">
          <p className="text-sm text-muted-foreground">
            На этот раз без уже показанного
          </p>
        </LoadingOverlay>
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        className="gradient-brand rounded-full px-6 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        Смотреть ещё варианты
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Потратит одну попытку из дневного лимита
      </p>

      {error && (
        <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-center text-sm font-medium text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
