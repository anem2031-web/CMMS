import { defineConfig } from "vitest/config";
import previous from "../read-scope-perf/vitest.config.mjs";
export default defineConfig({ ...previous, test: { ...previous.test, include: [
  ...previous.test.include,
  "server/tests/interactiveReadTransport.test.ts",
  "server/tests/improvementReadPerformance.test.ts",
  "server/tests/catalogPickerAccess.test.ts",
  "server/tests/catalogPickerUi.test.ts",
  "server/tests/catalogStock.test.ts",
  "server/tests/catalogStockField.test.tsx",
  "server/tests/inventoryListReadPerformance.test.ts",
  "tools/improvement-center/router.test.ts",
  "tools/improvement-center/ui-state.test.tsx",
] } });
