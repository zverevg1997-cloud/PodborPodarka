"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeleteSearchButtonProps {
  searchId: string;
}

export default function DeleteSearchButton({
  searchId,
}: DeleteSearchButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Удалить этот запрос из истории?")) {
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/searches/${searchId}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label="Удалить запрос"
      title="Удалить запрос"
      className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary disabled:opacity-50"
    >
      ✕
    </button>
  );
}
