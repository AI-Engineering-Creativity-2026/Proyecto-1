import { describe, expect, it } from "bun:test";
import { createFakeEvalAdapter } from "./eval-adapters";
import {
  assertEvalModeAllowed,
  parseCliOptions,
} from "./run-evals";
import {
  parseEvalCaseFile,
  evaluateAssertions,
  renderMarkdownReport,
  runEvalSuite,
  validatedMessages,
  type EvalCase,
} from "./evaluation-runner";

describe("evaluation runner", () => {
  it("runs the versioned suite with the deterministic fake adapter", async () => {
    const caseData: unknown = await Bun.file(new URL("./cases.json", import.meta.url)).json();
    const cases = parseEvalCaseFile(caseData).cases;
    let monotonicTime = 0;
    const report = await runEvalSuite(cases, createFakeEvalAdapter(), {
      now: () => new Date("2026-11-16T10:00:00.000Z"),
      monotonicNow: () => monotonicTime++,
    });

    expect(report.mode).toBe("fake");
    expect(report.generatedAt).toBe("2026-11-16T10:00:00.000Z");
    expect(report.results).toHaveLength(4);
    expect(report.results.every((result) => result.passed)).toBe(true);
    expect(report.results.every((result) => result.durationMs === 1)).toBe(true);
  });

  it("reports failed assertions without exposing model output", async () => {
    const testCase: EvalCase = {
      id: "failed-case",
      description: "Falla por una condición ausente",
      prompt: "Recommend Matrix",
      assertions: { requireAgentMessage: true, containsAll: ["expected phrase"] },
    };
    const report = await runEvalSuite([testCase], {
      mode: "fake",
      run: async () => ({
        messages: [{
          type: "agent_message",
          conversationId: "eval",
          content: "private model output should not appear in report",
          timestamp: "2026-11-16T10:00:00.000Z",
        }],
      }),
    }, { now: () => new Date("2026-11-16T10:00:00.000Z"), monotonicNow: () => 1 });
    const markdown = renderMarkdownReport(report);

    expect(report.results[0]).toMatchObject({
      passed: false,
      failures: ["Falta el texto esperado: expected phrase"],
    });
    expect(markdown).toContain("FAIL");
    expect(markdown).toContain("expected phrase");
    expect(markdown).not.toContain("private model output");
  });

  it("rejects invalid case files and invalid WebSocket messages", () => {
    expect(() => parseEvalCaseFile({ schemaVersion: 2, cases: [] })).toThrow("esquema versión 1");
    expect(() => validatedMessages([{ type: "agent_message", conversationId: "x" }])).toThrow(
      "no cumplen el contrato",
    );
  });

  it("checks every emitted event for forbidden configuration strings", () => {
    const testCase: EvalCase = {
      id: "no-config-leaks",
      description: "No configuration is exposed in events",
      prompt: "Recommend a movie",
      assertions: { excludes: ["GROQ_API_KEY"] },
    };
    const failures = evaluateAssertions(testCase, {
      messages: [{
        type: "ui_action",
        conversationId: "eval",
        action: {
          kind: "open_url",
          source: "imdb",
          url: "https://www.imdb.com/title/tt0133093/",
          reason: "GROQ_API_KEY was accidentally included",
        },
        timestamp: "2026-11-16T10:00:00.000Z",
      }],
    });

    expect(failures).toEqual(["Los eventos contienen texto prohibido: GROQ_API_KEY"]);
  });

  it("keeps real model execution out of CI and parses runner options", () => {
    expect(() => assertEvalModeAllowed("real", { CI: "true" })).toThrow(
      "deshabilitado en CI",
    );
    expect(() => assertEvalModeAllowed("fake", { CI: "true" })).not.toThrow();
    expect(parseCliOptions(["--mode", "real", "--output", "reports/manual.md"], "/repo")).toMatchObject({
      mode: "real",
      outputPath: "/repo/reports/manual.md",
    });
  });
});
