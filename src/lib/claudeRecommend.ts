import Anthropic from "@anthropic-ai/sdk";
import type { GiftIdea } from "@/lib/types";
import {
  OUTPUT_SCHEMA,
  RecommendError,
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseIdeas,
  type RecommendInput,
} from "@/lib/recommendShared";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function recommendWithClaude(
  input: RecommendInput,
): Promise<GiftIdea[]> {
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 });

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}:`, error.message);
    } else {
      console.error("Claude request failed:", error);
    }
    throw new RecommendError("Не удалось получить идеи от ИИ");
  }

  if (response.stop_reason === "refusal") {
    throw new RecommendError("ИИ не смог подобрать идеи по этому запросу");
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseIdeas(text);
}
