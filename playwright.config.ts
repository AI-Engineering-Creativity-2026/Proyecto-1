import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
  },
  webServer: {
    command: "bun --cwd widget dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173/demo.html",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
