import { startVitest } from "vitest/node";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
const config = { ...base, test: { ...base.test, include: [
  "server/tests/warehouseDeliverySignature.test.ts", "server/tests/accountingSignature.test.ts",
  "server/tests/operationalIssues.test.ts", "server/tests/ticketMaterialDeliveryWorkflow.test.ts",
] } };
const runner = await startVitest("test", [], { config: false, watch: false }, config);
if (!runner) process.exitCode = 1;
else {
  if (runner.state.getFiles().some(file => file.result?.state === "fail") || runner.state.getUnhandledErrors().length) process.exitCode = 1;
  await runner.close();
}
