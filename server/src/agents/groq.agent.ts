import { createGroq } from "@ai-sdk/groq";
import { generateText, type LanguageModel } from "ai";
import type { IncomingMessage, OutgoingMessage } from "@agichat/contracts";
import type { AgentPort, ConversationContext } from "./agent.port";
import { MockAgent } from "./mock.agent";

const AGENT_INSTRUCTIONS =
  "Eres AGIChat, un asistente en español que ayuda con recomendaciones de películas. Responde de forma clara y útil en Markdown.";
const SAFE_ERROR_MESSAGE =
  "No se pudo procesar tu mensaje. Intenta de nuevo.";

export type GroqTextGenerator = (
  model: string,
  prompt: string,
) => Promise<string>;

export class GroqAgent implements AgentPort {
  constructor(
    private readonly model: string,
    private readonly generate: GroqTextGenerator,
  ) {}

  async respond(
    message: OutgoingMessage,
    _context: ConversationContext,
  ): Promise<IncomingMessage[]> {
    try {
      const content = (await this.generate(this.model, message.content)).trim();
      if (!content) return [this.createError(message.conversationId)];

      const timestamp = new Date().toISOString();
      return [
        {
          type: "agent_typing",
          conversationId: message.conversationId,
          timestamp,
        },
        {
          type: "agent_message",
          conversationId: message.conversationId,
          content,
          timestamp,
        },
      ];
    } catch {
      return [this.createError(message.conversationId)];
    }
  }

  private createError(conversationId: string): IncomingMessage {
    return {
      type: "error",
      conversationId,
      error: { code: "AGENT_ERROR", message: SAFE_ERROR_MESSAGE },
      timestamp: new Date().toISOString(),
    };
  }
}

export interface AgentEnvironment extends Record<string, string | undefined> {
  AGENT_MODE?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  GROQ_BASE_URL?: string;
}

export interface ConfiguredGroqModel {
  modelId: string;
  model: LanguageModel;
}

export function createConfiguredGroqModel(
  environment: AgentEnvironment = process.env,
): ConfiguredGroqModel {
  const apiKey = environment.GROQ_API_KEY?.trim();
  const modelId = environment.GROQ_MODEL?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY is required when AGENT_MODE=groq.");
  if (!modelId) throw new Error("GROQ_MODEL is required when AGENT_MODE=groq.");

  const groq = createGroq({
    apiKey,
    ...(environment.GROQ_BASE_URL?.trim()
      ? { baseURL: environment.GROQ_BASE_URL.trim() }
      : {}),
  });
  return { modelId, model: groq(modelId) };
}

export function createConfiguredAgent(
  environment: AgentEnvironment = process.env,
): AgentPort {
  const mode = environment.AGENT_MODE?.trim() || "mock";

  if (mode === "mock") return new MockAgent();
  if (mode !== "groq") {
    throw new Error('AGENT_MODE must be either "mock" or "groq".');
  }

  const configuredModel = createConfiguredGroqModel(environment);
  return new GroqAgent(configuredModel.modelId, async (_modelId, prompt) => {
    const result = await generateText({
      model: configuredModel.model,
      instructions: AGENT_INSTRUCTIONS,
      prompt,
      maxRetries: 0,
      telemetry: { isEnabled: false },
    });
    return result.text;
  });
}
