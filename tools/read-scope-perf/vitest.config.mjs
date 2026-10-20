import { defineConfig } from "vitest/config";
import previous from "../documents-center-perf/vitest.config.mjs";
export default defineConfig({
  ...previous,
  test: { ...previous.test, include: [...previous.test.include, "server/tests/readScopePerformance.test.ts", "server/tests/technicianGuard.test.ts"] },
});
