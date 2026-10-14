import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  envDir: false,
  plugins: [{
    name: "forbid-live-database-and-environment",
    enforce: "pre",
    load(id) {
      if (/server\/_core\/(db(?:\/.*)?|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) {
        throw new Error("Database and environment modules are forbidden in this isolated test");
      }
    },
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../client/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../../shared", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    maxWorkers: 1,
    minWorkers: 1,
    include: [
      "server/tests/inventorySettlementPermissions.test.ts",
      "tools/inventory-settlement-permissions/ui.test.tsx",
      "server/tests/inventorySettlementPhase4Step3Ui.test.ts",
    ],
  },
});
