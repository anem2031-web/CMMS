import { startVitest } from "vitest/node";
import config from "./business-roles.vitest.config.mjs";
// This configuration rejects live DB/environment imports before loading tests.
const runner = await startVitest("test", [], { config: false, watch: false }, config);
if (!runner) process.exitCode = 1;
else {
  if (runner.state.getFiles().some(file => file.result?.state === "fail") || runner.state.getUnhandledErrors().length) process.exitCode = 1;
  await runner.close();
}
