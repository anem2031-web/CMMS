import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  envDir: false,
  plugins: [
    {
      name: "forbid-live-database-in-settlement-ui-tests",
      enforce: "pre",
      load(id) {
        if (
          /server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(
            id.replaceAll("\\", "/")
          )
        ) {
          throw new Error(
            "Live database and environment imports are forbidden in isolated UI tests"
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../client/src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../../shared", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tools/inventory-settlement-review/ui.test.tsx"],
    environment: "node",
    maxWorkers: 1,
    minWorkers: 1,
  },
});
