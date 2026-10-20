// Resolver for restricted Windows build workers: Node reads workspace sources;
// packages stay external exactly as in the production esbuild command.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
await build({
  entryPoints: ["./server/_core/index.ts"], absWorkingDir: root,
  platform: "node", packages: "external", bundle: true, format: "esm", outdir: "dist",
  plugins: [{ name: "workspace-source-resolver", setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      const shared = args.path.startsWith("@shared/");
      if (!shared && !args.path.startsWith(".") && !path.isAbsolute(args.path)) return { path: args.path, external: true };
      const resolved = shared ? path.resolve(root, "shared", args.path.slice(8)) : path.resolve(args.importer ? path.dirname(args.importer) : root, args.path);
      if (!resolved.startsWith(root + path.sep)) throw Error("Source outside workspace");
      const candidates = [resolved, ...[".ts", ".tsx", ".js", ".json", "/index.ts", "/index.js"].map(ext => resolved + ext)];
      if (resolved.endsWith(".js")) candidates.push(resolved.slice(0, -3) + ".ts");
      const file = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
      if (!file) throw Error(`Workspace source not found: ${args.path}`);
      return { path: file, namespace: "workspace" };
    });
    builder.onLoad({ filter: /.*/, namespace: "workspace" }, args => ({ contents: fs.readFileSync(args.path, "utf8"), loader: path.extname(args.path).slice(1), resolveDir: path.dirname(args.path) }));
  } }],
});
