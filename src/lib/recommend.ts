import type { GiftIdea } from "@/lib/types";
import { isClaudeConfigured, recommendWithClaude } from "@/lib/claudeRecommend";
import { isYandexConfigured, recommendWithYandex } from "@/lib/yandexRecommend";
import type { RecommendInput } from "@/lib/recommendShared";

export { RecommendError } from "@/lib/recommendShared";
export type { RecommendInput } from "@/lib/recommendShared";

export type AiProvider = "claude" | "yandex";

/**
 * Какой моделью подбирать идеи. Задаётся переменной AI_PROVIDER, чтобы
 * переключение не требовало правок в коде и нового деплоя.
 *
 * Если выбранный провайдер не настроен, берём любой настроенный: лучше
 * работающий подбор на «не том» провайдере, чем неработающий сайт из-за
 * забытой переменной окружения.
 */
export function activeProvider(): AiProvider | null {
  const requested = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (requested === "yandex" && isYandexConfigured()) return "yandex";
  if (requested === "claude" && isClaudeConfigured()) return "claude";

  if (requested) {
    console.error(
      `AI_PROVIDER=${requested}, но его ключи не заданы — берём другого провайдера`,
    );
  }

  if (isYandexConfigured()) return "yandex";
  if (isClaudeConfigured()) return "claude";
  return null;
}

export function isRecommendConfigured(): boolean {
  return activeProvider() !== null;
}

export async function recommendIdeas(
  input: RecommendInput,
): Promise<GiftIdea[]> {
  switch (activeProvider()) {
    case "yandex":
      return recommendWithYandex(input);
    case "claude":
      return recommendWithClaude(input);
    default:
      throw new Error("Не настроен ни один провайдер ИИ");
  }
}
