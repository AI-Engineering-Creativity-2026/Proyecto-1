import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createFakeEvalAdapter, createWebSocketEvalAdapter } from "./eval-adapters";
import {
  parseEvalCaseFile,
  renderMarkdownReport,
  runEvalSuite,
  type EvalMode,
} from "./evaluation-runner";

interface CliOptions {
  mode: EvalMode;
  casesPath: string;
  outputPath: string;
  help: boolean;
}

export function parseCliOptions(args: readonly string[], cwd = process.cwd()): CliOptions {
  let mode: EvalMode = "fake";
  let casesPath = resolve(cwd, "evals/cases.json");
  let outputPath = resolve(cwd, "evals/report.md");
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--mode") {
      const value = args[index + 1];
      if (value !== "fake" && value !== "real") throw new Error("--mode debe ser fake o real.");
      mode = value;
      index += 1;
    } else if (argument === "--cases") {
      const value = args[index + 1];
      if (!value) throw new Error("--cases requiere una ruta.");
      casesPath = resolve(cwd, value);
      index += 1;
    } else if (argument === "--output") {
      const value = args[index + 1];
      if (!value) throw new Error("--output requiere una ruta.");
      outputPath = resolve(cwd, value);
      index += 1;
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }

  return { mode, casesPath, outputPath, help };
}

export function assertEvalModeAllowed(mode: EvalMode, environment: Record<string, string | undefined>): void {
  if (mode === "real" && /^(?:true|1)$/i.test(environment.CI?.trim() ?? "")) {
    throw new Error("El modo real está deshabilitado en CI; usa --mode fake.");
  }
}

async function main(args: readonly string[]): Promise<number> {
  const options = parseCliOptions(args);
  if (options.help) {
    console.log("Uso: bun run eval:run -- [--mode fake|real] [--cases evals/cases.json] [--output evals/report.md]");
    return 0;
  }
  assertEvalModeAllowed(options.mode, process.env);

  const caseData: unknown = await Bun.file(options.casesPath).json();
  const cases = parseEvalCaseFile(caseData).cases;
  const adapter = options.mode === "fake"
    ? createFakeEvalAdapter()
    : createWebSocketEvalAdapter(process.env.AGICHAT_EVAL_WS_URL ?? "ws://localhost:3000/ws");
  const report = await runEvalSuite(cases, adapter);
  const markdown = renderMarkdownReport(report);

  await mkdir(dirname(options.outputPath), { recursive: true });
  await Bun.write(options.outputPath, markdown);
  const passed = report.results.filter((result) => result.passed).length;
  const skipped = report.results.filter((result) => result.skipped).length;
  const failed = report.results.length - passed - skipped;
  console.log(`Evals ${report.mode}: ${passed} aprobados, ${failed} fallidos, ${skipped} omitidos. Reporte: ${options.outputPath}`);
  for (const result of report.results.filter((item) => !item.passed)) {
    console.error(`${result.id}: ${result.failures.join("; ")}`);
  }
  return failed === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : "No se pudieron ejecutar los evals.");
    process.exitCode = 1;
  }
}
