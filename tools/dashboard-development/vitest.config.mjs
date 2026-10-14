import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  envDir: false,
  plugins: [{ name: "forbid-live-db", enforce: "pre", load(id) {
    if (/server\/_core\/(db(?:\/.*)?|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) throw new Error("Live database/environment modules are forbidden in dashboard tests");
  } }],
  resolve: { alias: { "@": fileURLToPath(new URL("../../client/src", import.meta.url)), "@shared": fileURLToPath(new URL("../../shared", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", minWorkers: 1, maxWorkers: 1, include: [
    "server/tests/dashboardOverview.test.ts", "server/tests/dashboardAccess.test.ts", "server/tests/dashboardReader.test.ts",
    "server/tests/dashboardSnapshots.test.ts",
    "tools/dashboard-development/ui.test.tsx", "server/tests/authz.test.ts", "server/tests/inventorySettlementPermissions.test.ts",
  ] },
});
