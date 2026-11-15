import { existsSync, readFileSync } from "node:fs";

const coverageFile = "coverage/lcov.info";
const minimumCoverage = 80;

interface CoverageTotals {
  functionsFound: number;
  functionsHit: number;
  branchesFound: number;
  branchesHit: number;
  statementsFound: number;
  statementsHit: number;
}

interface CoverageScope {
  totals: CoverageTotals;
  lines: Map<string, boolean>;
}

function addRecordTotals(
  scope: CoverageScope,
  record: string,
): void {
  let file = "unknown";

  for (const line of record.split("\n")) {
    const separator = line.indexOf(":");
    const metric = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? "" : line.slice(separator + 1);
    const value = Number(rawValue);

    if (metric === "SF") {
      file = rawValue;
      continue;
    }

    if (metric === "DA") {
      const [lineNumber, hitCount] = rawValue.split(",");
      if (lineNumber !== undefined && hitCount !== undefined) {
        scope.lines.set(`${file}:${lineNumber}`, Number(hitCount) > 0);
      }
      continue;
    }

    if (!Number.isFinite(value)) continue;

    if (metric === "FNF") scope.totals.functionsFound += value;
    if (metric === "FNH") scope.totals.functionsHit += value;
    if (metric === "BRF") scope.totals.branchesFound += value;
    if (metric === "BRH") scope.totals.branchesHit += value;
    if (metric === "LF") scope.totals.statementsFound += value;
    if (metric === "LH") scope.totals.statementsHit += value;
  }
}

function percentage(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

function createScope(): CoverageScope {
  return {
    totals: {
      functionsFound: 0,
      functionsHit: 0,
      branchesFound: 0,
      branchesHit: 0,
      statementsFound: 0,
      statementsHit: 0,
    },
    lines: new Map(),
  };
}

function measuresFor(scope: CoverageScope) {
  return {
    lines: percentage(
      [...scope.lines.values()].filter(Boolean).length,
      scope.lines.size,
    ),
    functions: percentage(scope.totals.functionsHit, scope.totals.functionsFound),
    branches: percentage(scope.totals.branchesHit, scope.totals.branchesFound),
    statements: percentage(scope.totals.statementsHit, scope.totals.statementsFound),
  };
}

const scopes = {
  global: createScope(),
  core: createScope(),
  widget: createScope(),
};

let coverage: string;

const widgetCoverageFile = "coverage/widget/lcov.info";
const coverageFiles = [coverageFile, widgetCoverageFile].filter(existsSync);
if (coverageFiles.length === 0) {
  console.error(`No se encontró el reporte de cobertura: ${coverageFile}`);
  process.exit(1);
}

for (const reportFile of coverageFiles) {
  coverage = readFileSync(reportFile, "utf8");
  for (const record of coverage.split("end_of_record")) {
    const source = record.match(/^SF:(.+)$/m)?.[1]?.replaceAll("\\", "/") ?? "";
    addRecordTotals(scopes.global, record);

    if (source.includes("packages/core/src/")) {
      addRecordTotals(scopes.core, record);
    }

    if (
      reportFile === widgetCoverageFile ||
      source.includes("widget/src/")
    ) {
      addRecordTotals(scopes.widget, record);
    }
  }
}

const measures = {
  global: measuresFor(scopes.global),
  core: measuresFor(scopes.core),
  widget: measuresFor(scopes.widget),
};

for (const [name, scope] of Object.entries(measures)) {
  console.log(
    `Cobertura ${name}: líneas ${scope.lines.toFixed(2)}%, funciones ${scope.functions.toFixed(2)}%, ramas ${scope.branches.toFixed(2)}%, sentencias ${scope.statements.toFixed(2)}%`,
  );
}

const missingScope =
  scopes.core.lines.size === 0 ||
  scopes.widget.lines.size === 0 ||
  scopes.core.totals.statementsFound === 0 ||
  scopes.widget.totals.statementsFound === 0;
const belowMinimum = Object.values(measures).some((scopeMeasures) =>
  Object.values(scopeMeasures).some((value) => value < minimumCoverage)
);

if (missingScope || belowMinimum) {
  console.error(
    `La cobertura global, de Core y del widget debe alcanzar ${minimumCoverage}% en todas las métricas.`,
  );
  process.exit(1);
}
