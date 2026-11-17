import { describe, expect, it } from "bun:test";
import { parseSmokeArgs, runSmokeSuite } from "../scripts/smoke-real";

describe("smoke-real script", () => {
  it("requires --confirmar-gasto before opening a WebSocket or spending quota", async () => {
    const opts = parseSmokeArgs([], {});
    expect(opts.confirmSpend).toBe(false);
    expect(opts.wsUrl).toBe("ws://localhost:3000/ws");
    await expect(runSmokeSuite(opts)).rejects.toThrow("--confirmar-gasto");
  });

  it("parses confirmation flag and custom WebSocket endpoint", () => {
    const opts = parseSmokeArgs(["--confirmar-gasto"], {
      SMOKE_WS_URL: "ws://localhost:3099/ws",
      SMOKE_TIMEOUT_MS: "15000",
    });
    expect(opts.confirmSpend).toBe(true);
    expect(opts.wsUrl).toBe("ws://localhost:3099/ws");
    expect(opts.timeoutMs).toBe(15_000);
  });
});
