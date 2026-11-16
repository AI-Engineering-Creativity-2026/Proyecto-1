import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { isIncomingMessage, type IncomingMessage } from "@agichat/contracts";

const EvalAssertionsSchema = Type.Object({
  requireAgentMessage: Type.Optional(Type.Boolean()),
  requireRefusal: Type.Optional(Type.Boolean()),
  containsAll: Type.Optional(Type.Array(Type.String())),
  containsAny: Type.Optional(Type.Array(Type.String())),
  excludes: Type.Optional(Type.Array(Type.String())),
  providers: Type.Optional(Type.Array(Type.Union([
    Type.Literal("tmdb"),
    Type.Literal("google_books"),
  ]))),
  actions: Type.Optional(Type.Array(Type.Union([
    Type.Literal("imdb"),
    Type.Literal("google_books"),
  ]))),
  poster: Type.Optional(Type.Boolean()),
});

const EvalCaseSchema = Type.Object({
  id: Type.String({ minLength: 1, pattern: "^[a-z0-9][a-z0-9-]*$" }),
  description: Type.String({ minLength: 1 }),
  prompt: Type.String({ minLength: 1, maxLength: 2000 }),
  assertions: EvalAssertionsSchema,
});

export const EvalCaseFileSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  cases: Type.Array(EvalCaseSchema, { minItems: 1 }),
});

export type EvalCase = Static<typeof EvalCaseSchema>;
export type EvalCaseFile = Static<typeof EvalCaseFileSchema>;
export type EvalMode = "fake" | "real";

export interface EvalObservation {
  messages: IncomingMessage[];
  toolCalls?: string[];
}

export interface EvalAdapter {
  mode: EvalMode;
  run: (prompt: string) => Promise<EvalObservation>;
}

export interface EvalCaseResult {
  id: string;
  description: string;
  passed: boolean;
  durationMs: number;
  failures: string[];
}

export interface EvalReport {
  schemaVersion: 1;
  mode: EvalMode;
  generatedAt: string;
  results: EvalCaseResult[];
}

export function parseEvalCaseFile(value: unknown): EvalCaseFile {
  if (!Value.Check(EvalCaseFileSchema, value)) {
    throw new TypeError("El archivo de casos de evaluación no cumple el esquema versión 1.");
  }
  return Value.Parse(EvalCaseFileSchema, value);
}

export function runEvalSuite(
  cases: readonly EvalCase[],
  adapter: EvalAdapter,
  options: { now?: () => Date; monotonicNow?: () => number } = {},
): Promise<EvalReport> {
  return runCases(cases, adapter, options);
}

async function runCases(
  cases: readonly EvalCase[],
  adapter: EvalAdapter,
  options: { now?: () => Date; monotonicNow?: () => number },
): Promise<EvalReport> {
  const now = options.now ?? (() => new Date());
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const results: EvalCaseResult[] = [];

  for (const testCase of cases) {
    const started = monotonicNow();
    let failures: string[];
    try {
      failures = evaluateAssertions(testCase, await adapter.run(testCase.prompt));
    } catch {
      failures = ["No se pudo ejecutar el caso con el adaptador configurado."];
    }
    results.push({
      id: testCase.id,
      description: testCase.description,
      passed: failures.length === 0,
      durationMs: Math.max(0, Math.round(monotonicNow() - started)),
      failures,
    });
  }

  return {
    schemaVersion: 1,
    mode: adapter.mode,
    generatedAt: now().toISOString(),
    results,
  };
}

export function evaluateAssertions(testCase: EvalCase, observation: EvalObservation): string[] {
  const failures: string[] = [];
  const agentMessages = observation.messages.filter((message) => message.type === "agent_message");
  const answer = agentMessages.map((message) => message.content).join("\n");
  const normalizedAnswer = answer.toLocaleLowerCase();
  const normalizedEvents = JSON.stringify(observation.messages).toLocaleLowerCase();
  const assertions = testCase.assertions;

  if (assertions.requireAgentMessage && agentMessages.length === 0) {
    failures.push("No se emitió agent_message.");
  }
  if (assertions.requireRefusal && !/solo puedo ayudar|no puedo (?:ayudar|proporcionar)/i.test(answer)) {
    failures.push("La respuesta no contiene una negativa segura.");
  }
  for (const phrase of assertions.containsAll ?? []) {
    if (!normalizedAnswer.includes(phrase.toLocaleLowerCase())) {
      failures.push(`Falta el texto esperado: ${phrase}`);
    }
  }
  const anyPhrases = assertions.containsAny ?? [];
  if (anyPhrases.length > 0 && !anyPhrases.some((phrase) => normalizedAnswer.includes(phrase.toLocaleLowerCase()))) {
    failures.push("No aparece ninguno de los textos alternativos esperados.");
  }
  for (const phrase of assertions.excludes ?? []) {
    if (normalizedEvents.includes(phrase.toLocaleLowerCase())) {
      failures.push(`Los eventos contienen texto prohibido: ${phrase}`);
    }
  }

  const providers = new Set(agentMessages.flatMap((message) => message.providers ?? []));
  for (const provider of assertions.providers ?? []) {
    if (!providers.has(provider)) failures.push(`No se atribuyó el proveedor ${provider}.`);
  }

  const actionSources = new Set(observation.messages.flatMap((message) =>
    message.type === "ui_action" ? [message.action.source] : [],
  ));
  for (const source of assertions.actions ?? []) {
    if (!actionSources.has(source)) failures.push(`No se emitió la acción permitida ${source}.`);
  }

  if (assertions.poster && !agentMessages.some((message) =>
    message.attachments?.some((attachment: { type: string }) => attachment.type === "poster"),
  )) {
    failures.push("No se adjuntó un póster.");
  }

  return failures;
}

export function renderMarkdownReport(report: EvalReport): string {
  const passed = report.results.filter((result) => result.passed).length;
  const lines = [
    "# Reporte de evaluaciones AGIChat",
    "",
    `- Modo: **${report.mode}**`,
    `- Generado: ${report.generatedAt}`,
    `- Resultado: **${passed}/${report.results.length} aprobados**`,
    "",
    "| Caso | Estado | Duración | Fallos |",
    "| --- | --- | ---: | --- |",
    ...report.results.map((result) => {
      const failures = result.failures.length === 0
        ? "—"
        : result.failures.map(escapeTableCell).join("<br>");
      return `| ${escapeTableCell(result.id)} | ${result.passed ? "PASS" : "FAIL"} | ${result.durationMs} ms | ${failures} |`;
    }),
    "",
  ];
  return lines.join("\n");
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
}

export function validatedMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value) || !value.every(isIncomingMessage)) {
    throw new TypeError("El servidor devolvió eventos que no cumplen el contrato.");
  }
  return value;
}
