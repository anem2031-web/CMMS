import { defineConfig } from "vitest/config";
import path from "node:path";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
export default defineConfig({
  ...base,
  resolve: { alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["tools/material-costs/ui.test.tsx"], pool: "forks", maxWorkers: 1, minWorkers: 1 },
});
