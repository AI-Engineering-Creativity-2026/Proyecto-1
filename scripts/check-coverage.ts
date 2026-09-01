import { readFileSync } from "node:fs";

const coverageFile = "coverage/lcov.info";
const minimumCoverage = 80;

interface CoverageTotals {
  functionsFound: number;
  functionsHit: number;
  branchesFound: number;
  branchesHit: number;
}

function addRecordTotals(
  totals: CoverageTotals,
  record: string,
  lines: Map<string, boolean>,
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
        lines.set(`${file}:${lineNumber}`, Number(hitCount) > 0);
      }
      continue;
    }

    if (!Number.isFinite(value)) continue;

    if (metric === "FNF") totals.functionsFound += value;
    if (metric === "FNH") totals.functionsHit += value;
    if (metric === "BRF") totals.branchesFound += value;
    if (metric === "BRH") totals.branchesHit += value;
  }
}

function percentage(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

const totals: CoverageTotals = {
  functionsFound: 0,
  functionsHit: 0,
  branchesFound: 0,
  branchesHit: 0,
};
const lines = new Map<string, boolean>();

let coverage: string;

try {
  coverage = readFileSync(coverageFile, "utf8");
} catch {
  console.error(`No se encontró el reporte de cobertura: ${coverageFile}`);
  process.exit(1);
}

for (const record of coverage.split("end_of_record")) {
  addRecordTotals(totals, record, lines);
}

const measures = {
  lines: percentage(
    [...lines.values()].filter(Boolean).length,
    lines.size,
  ),
  functions: percentage(totals.functionsHit, totals.functionsFound),
  branches: percentage(totals.branchesHit, totals.branchesFound),
};

console.log(
  `Cobertura: líneas ${measures.lines.toFixed(2)}%, funciones ${measures.functions.toFixed(2)}%, ramas ${measures.branches.toFixed(2)}%`,
);

if (Object.values(measures).some((value) => value < minimumCoverage)) {
  console.error(`La cobertura mínima requerida es ${minimumCoverage}%.`);
  process.exit(1);
}
