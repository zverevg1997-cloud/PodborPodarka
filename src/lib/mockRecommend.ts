import type { GiftIdea } from "@/lib/types";

export interface MockRecommendInput {
  profileName: string;
  occasion: string;
  budget?: string;
  timeframe?: string;
  city?: string;
  mood?: string;
  interests?: string | null;
}

/**
 * Заглушка вызова ИИ. Возвращает 3-4 захардкоженные идеи в формате,
 * который позже будет отдавать реальный вызов Claude API.
 *
 * TODO: заменить на реальный вызов Claude API (Anthropic) — собрать промпт
 * из данных профиля/анкеты и распарсить ответ в этот же формат GiftIdea[].
 */
export function mockRecommend(input: MockRecommendInput): GiftIdea[] {
  const { profileName, occasion } = input;

  const ideas: GiftIdea[] = [
    {
      name: "Беспроводные наушники",
      reason: `Универсальный подарок на «${occasion}» для ${profileName}: подойдут и для работы, и для отдыха, не требуют знания точных предпочтений.`,
      searchQuery: "беспроводные наушники подарок",
      kind: "product",
    },
    {
      name: "Подарочный сертификат в SPA",
      reason: `Хороший вариант, если сложно угадать вкус — ${profileName} сможет сам(а) выбрать процедуру и время для отдыха.`,
      searchQuery: "подарочный сертификат спа салон",
      kind: "local",
    },
    {
      name: "Набор для домашней латте-станции",
      reason: `Приятный тематический подарок для дома: кофейный набор с гейзерной кофеваркой понравится тем, кто любит уют.`,
      searchQuery: "набор кофемания подарочный",
      kind: "product",
    },
    {
      name: "Персонализированный плед с вышивкой",
      reason: `Тёплый и личный подарок с именем или инициалами — хорошо подчёркивает повод «${occasion}».`,
      searchQuery: "плед с вышивкой имени подарок",
      kind: "product",
    },
    {
      name: "Букет из сезонных цветов",
      reason: `Беспроигрышное дополнение к основному подарку на «${occasion}» — доставку можно заказать ко времени.`,
      searchQuery: "доставка букета цветов",
      kind: "local",
    },
    {
      name: "Настольная игра для компании",
      reason: `Подойдёт, если ${profileName} любит проводить время с семьёй или друзьями — подарок на вечер вместе.`,
      searchQuery: "настольная игра для компании",
      kind: "product",
    },
  ];

  return ideas;
}
