import { startVitest } from "vitest/node";
import config from "./technician-need-timing.vitest.config.mjs";

// Programmatic config avoids the CLI config bundler's parent-directory scan.
// envDir:false and the inherited database/environment blocker stay enabled.
const runner = await startVitest("test", [], { config: false, watch: false }, config);
if (!runner) process.exitCode = 1;
else {
  if (runner.state.getFiles().some(file => file.result?.state === "fail") || runner.state.getUnhandledErrors().length) process.exitCode = 1;
  await runner.close();
}
