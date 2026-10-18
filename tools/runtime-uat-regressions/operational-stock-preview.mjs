import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
const root = process.cwd();
const client = await build({ absWorkingDir: root, bundle: true, write: false, platform: "browser", target: "es2022", jsx: "automatic", tsconfigRaw: {}, define: { "process.env.NODE_ENV": '"production"' },
  stdin: { loader: "tsx", resolveDir: root, contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Toaster} from 'sonner';import Preview from './tools/runtime-uat-regressions/operational-stock-preview-fixture';createRoot(document.getElementById('root')).render(<><Preview/><Toaster/></>);` },
  plugins: [{ name: "isolated-stock-ui", setup(builder) {
    builder.onResolve({ filter: /^@\/(lib\/trpc|contexts\/LanguageContext)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onResolve({ filter: /.*/ }, args => {
      if (/server[\\/]|dotenv/.test(args.path)) throw Error("Server/environment import forbidden in preview");
      const base = args.path.startsWith("@/") ? path.join(root, "client/src", args.path.slice(2)) : args.path.startsWith("@shared/") ? path.join(root, "shared", args.path.slice(8)) : args.path.startsWith(".") ? path.resolve(args.resolveDir || root, args.path) : null;
      const found = base ? [base, base + ".tsx", base + ".ts", base + ".js"].find(p => fs.existsSync(p) && fs.statSync(p).isFile()) : createRequire(path.isAbsolute(args.importer || "") ? args.importer : path.join(root, "package.json")).resolve(args.path);
      if (!found?.startsWith(root + path.sep)) throw Error("Dependency outside workspace");
      return { path: found, namespace: "local" };
    });
    builder.onLoad({ filter: /.*/, namespace: "local" }, args => ({ contents: fs.readFileSync(args.path, "utf8"), resolveDir: path.dirname(args.path), loader: args.path.endsWith("tsx") ? "tsx" : args.path.endsWith("ts") ? "ts" : "js" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ resolveDir: root, loader: "tsx", contents: args.path === "@/lib/trpc"
      ? `export {trpc} from './tools/runtime-uat-regressions/operational-stock-preview-fixture';`
      : `import {language} from './tools/runtime-uat-regressions/operational-stock-preview-fixture';export const useTranslation=()=>({language,dir:language==='en'?'ltr':'rtl'});` }));
  } }],
});
const candidates = new Set();
for (const directory of ["client/src/components/ui", "client/src/components/inventory", "client/src/pages/operational-issues"]) {
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith("tsx"))) for (const token of fs.readFileSync(path.join(directory, file), "utf8").match(/[A-Za-z0-9!_:/%.\[\]@-]+/g) || []) candidates.add(token);
}
const compiler = await compile(fs.readFileSync("client/src/index.css", "utf8"), { base: path.join(root, "client/src"), onDependency() {} });
const css = compiler.build([...candidates]);
http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:5199");
  if (url.pathname === "/preview.js") { response.setHeader("Content-Type", "text/javascript"); return response.end(client.outputFiles[0].text); }
  const lang = url.searchParams.get("lang") || "ar";
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated operational stock preview</title><style>${css}body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><div id="root"></div><script src="/preview.js"></script></html>`);
}).listen(5199, "127.0.0.1", () => console.log("Local fixture only: http://127.0.0.1:5199/?lang=ar — no API/database"));
