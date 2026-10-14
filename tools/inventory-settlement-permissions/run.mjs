import { startVitest } from "vitest/node";
import config from "./vitest.config.mjs";

const runner = await startVitest("test", config.test.include, {
  config: false,
  watch: false,
}, config);
if (!runner) process.exitCode = 1;
else {
  if (runner.state.getFiles().length !== config.test.include.length ||
      runner.state.getFiles().some(file => file.result?.state === "fail") ||
      runner.state.getUnhandledErrors().length) process.exitCode = 1;
  await runner.close();
}
