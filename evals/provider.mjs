import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default class FunctionalAgentProvider {
  id() { return "agichat:deterministic-agent"; }

  async callApi(prompt) {
    const { stdout } = await execFileAsync("bun", [
      new URL("./run-functional-case.ts", import.meta.url).pathname,
      prompt,
    ], { maxBuffer: 1024 * 1024 });
    return { output: stdout };
  }
}
