import { startVitest } from "vitest/node";
import config from "./vitest.config.mjs";
const auditConfig = { ...config, test: { ...config.test, include: [
  "server/tests/catalogStock.test.ts",
  "server/tests/catalogPickerAccess.test.ts",
  "server/tests/catalogPickerUi.test.ts",
  "server/tests/catalogStockField.test.tsx",
  "server/tests/inventoryListReadPerformance.test.ts",
] } };
const context = await startVitest("test", [], { config: false, watch: false }, auditConfig);
process.exitCode = !context || context.state.getFiles().some(file => file.result?.state === "fail") || context.state.getUnhandledErrors().length ? 1 : 0;
await context?.close();
