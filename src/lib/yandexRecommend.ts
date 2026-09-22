import type { GiftIdea } from "@/lib/types";
import {
  OUTPUT_SCHEMA,
  RecommendError,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseIdeas,
  type RecommendInput,
} from "@/lib/recommendShared";

// Яндекс предоставляет OpenAI-совместимый эндпоинт — он удобнее «родного»
// /foundationModels/v1/completion тем, что структурированный вывод
// задаётся привычным response_format с json_schema.
const ENDPOINT = "https://llm.api.cloud.yandex.net/v1/chat/completions";

export function isYandexConfigured(): boolean {
  return Boolean(process.env.YANDEX_API_KEY && process.env.YANDEX_FOLDER_ID);
}

export async function recommendWithYandex(
  input: RecommendInput,
): Promise<GiftIdea[]> {
  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    throw new RecommendError("Подбор временно недоступен");
  }

  // Модель задаётся полным URI вида gpt://<folder>/yandexgpt/latest.
  // Через переменную можно переключиться на другую версию или на lite.
  const model =
    process.env.YANDEX_MODEL || `gpt://${folderId}/yandexgpt/latest`;

  // У маршрута maxDuration 60 секунд — обрываем чуть раньше, чтобы успеть
  // вернуть человеку внятную ошибку, а не наткнуться на обрыв функции.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Api-Key ${apiKey}`,
        // В OpenAI-совместимом API Яндекса идентификатор каталога
        // передаётся именно этим заголовком.
        "OpenAI-Project": folderId,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        max_tokens: 4000,
        temperature: 0.6,
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: { name: "gift_ideas", schema: OUTPUT_SCHEMA },
        },
      }),
    });
  } catch (error) {
    console.error("YandexGPT request failed:", error);
    throw new RecommendError("Не удалось получить идеи от ИИ");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error(`YandexGPT error ${response.status}:`, details.slice(0, 500));
    throw new RecommendError("Не удалось получить идеи от ИИ");
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string };
    }>;
  } | null;

  const choice = data?.choices?.[0];

  if (choice?.finish_reason === "length") {
    // Ответ оборвался на середине — JSON будет неполным, разбирать нечего.
    throw new RecommendError("ИИ вернул неполный ответ, попробуйте ещё раз");
  }

  const text = choice?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new RecommendError("ИИ вернул пустой ответ");
  }

  return parseIdeas(text);
}
