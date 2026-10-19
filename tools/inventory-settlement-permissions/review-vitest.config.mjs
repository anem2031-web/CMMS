import { defineConfig } from "vitest/config";
export default defineConfig({
  envDir: false,
  plugins: [
    {
      name: "forbid-live-inventory-clients",
      enforce: "pre",
      load(id) {
        if (
          /server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(
            id.replaceAll("\\", "/")
          )
        )
          throw new Error(
            "Live database/environment imports forbidden in settlement review tests"
          );
      },
    },
  ],
  test: {
    include: ["tools/inventory-settlement-permissions/review-service.test.ts"],
    environment: "node",
    maxWorkers: 1,
    minWorkers: 1,
  },
});
