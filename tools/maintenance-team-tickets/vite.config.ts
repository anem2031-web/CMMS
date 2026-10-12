import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(
  new URL(
    "../../client/src/features/maintenance-team-tickets/preview",
    import.meta.url
  )
);
export default defineConfig({
  root,
  envDir: root,
  envPrefix: "MTT_PREVIEW_",
  esbuild: false,
  plugins: [
    tailwindcss(),
    {
      name: "isolated-typescript",
      enforce: "pre",
      transform(code, id) {
        if (!/\.[cm]?tsx?$/.test(id)) return null;
        return {
          code: ts.transpileModule(code, {
            fileName: id,
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              jsx: ts.JsxEmit.ReactJSX,
              sourceMap: false,
            },
          }).outputText,
          map: null,
        };
      },
    },
  ],
  cacheDir: fileURLToPath(new URL("./.cache", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5198,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] },
  },
  preview: { host: "127.0.0.1", port: 5198, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./.build", import.meta.url)),
    emptyOutDir: false,
    minify: false,
  },
});
