import { startVitest } from "vitest/node";
import config from "./vitest.config.mjs";
const context = await startVitest("test", [], { config: false, watch: false }, config);
process.exitCode = !context || context.state.getFiles().some(file => file.result?.state === "fail") || context.state.getUnhandledErrors().length ? 1 : 0;
await context?.close();
