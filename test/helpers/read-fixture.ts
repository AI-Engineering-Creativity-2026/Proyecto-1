import { readFileSync } from "node:fs";

export function readFixture(url: URL): string {
  return readFileSync(url, "utf8");
}
