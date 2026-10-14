import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tools/improvement-center/router.test.ts"], environment: "node", maxWorkers: 1, minWorkers: 1 } });
