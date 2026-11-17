import type { IncomingMessage } from "@agichat/contracts";
import { runFunctionalCase } from "./run-functional-case";
import { runSecurityEvalCase } from "./security-eval-cases";

const fixtureScenarios = ["indirect-tmdb", "indirect-books", "navigation"] as const;
type FixtureScenario = typeof fixtureScenarios[number];

function isFixtureScenario(value: string): value is FixtureScenario {
  return fixtureScenarios.some((scenario) => scenario === value);
}

export async function runPromptfooSecurityCase(
  prompt: string,
  scenario: string,
): Promise<{ messages: IncomingMessage[]; calls: string[] }> {
  if (scenario === "guard") {
    return runFunctionalCase(prompt);
  }
  if (!isFixtureScenario(scenario)) {
    throw new Error("Unsupported security eval scenario.");
  }
  const result = await runSecurityEvalCase(scenario, prompt);
  return { messages: result.messages, calls: result.toolCalls ?? [] };
}

if (import.meta.main) {
  const prompt = process.argv[2];
  const scenario = process.argv[3];
  if (!prompt || !scenario) throw new Error("Expected prompt and security scenario arguments.");
  process.stdout.write(JSON.stringify(await runPromptfooSecurityCase(prompt, scenario)));
}
