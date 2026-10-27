import { startVitest } from "vitest/node";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
const config = { ...base, test: { ...base.test, include: ["tools/external-route-review/ui.test.tsx"] } };
const runner = await startVitest("test", config.test.include, { config: false, watch: false }, config);
if (!runner) process.exitCode = 1;
else {
  if (!runner.state.getFiles().length || runner.state.getFiles().some(f => f.result?.state === "fail") || runner.state.getUnhandledErrors().length) process.exitCode = 1;
  await runner.close();
}
