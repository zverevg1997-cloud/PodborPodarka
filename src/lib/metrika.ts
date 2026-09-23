declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const COUNTER_ID = Number(process.env.NEXT_PUBLIC_METRIKA_ID);

/**
 * Идентификаторы целей. Держим списком, чтобы имена в коде и в интерфейсе
 * Метрики нельзя было незаметно рассинхронизировать: опечатка в строке —
 * и цель просто перестанет набирать данные, без всякой ошибки.
 */
export const GOALS = {
  /** Анкета отправлена, идеи получены. */
  recommendDone: "recommend_done",
  /** Клик по идее — переход в магазин или в поиск. */
  giftClick: "gift_click",
  /** Нажата кнопка «Смотреть ещё варианты». */
  moreIdeas: "more_ideas",
  /** Почта подтверждена кодом, аккаунт создан. */
  signupDone: "signup_done",
} as const;

export type GoalName = (typeof GOALS)[keyof typeof GOALS];

/** Отправляет достижение цели. Молча ничего не делает, если счётчик выключен. */
export function reachGoal(goal: GoalName, params?: Record<string, unknown>) {
  if (!COUNTER_ID || typeof window === "undefined" || !window.ym) return;
  window.ym(COUNTER_ID, "reachGoal", goal, params);
}

/** Сообщает счётчику о переходе на новый адрес при навигации без перезагрузки. */
export function trackPageView(url: string) {
  if (!COUNTER_ID || typeof window === "undefined" || !window.ym) return;
  window.ym(COUNTER_ID, "hit", url);
}
