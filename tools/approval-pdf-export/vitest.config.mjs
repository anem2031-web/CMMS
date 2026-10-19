import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  envDir: false,
  plugins: [{ name: "forbid-live-database", enforce: "pre", load(id) {
    if (/server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) throw Error("Live database/environment modules are forbidden in isolated PDF tests");
  } }],
  resolve: { alias: { "@": fileURLToPath(new URL("../../client/src", import.meta.url)), "@shared": fileURLToPath(new URL("../../shared", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["tools/approval-pdf-export/*.test.ts"], environment: "node", maxWorkers: 1, minWorkers: 1 },
});
