import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build, transformSync } from "esbuild";
import { compile } from "@tailwindcss/node";
import ts from "typescript";

// Isolated preview of real client controls and the actual delegate-card JSX.
// Explicit fixtures only. Never starts the CMMS server or loads API/DB modules.
const root = process.cwd(), out = path.join(root, "docs/runtime-uat/2026-10-17");
const require = createRequire(import.meta.url), cache = new Map();
let language = "ar", translation;
function load(file) {
  file = path.resolve(root, file);
  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}server${path.sep}`)) throw new Error("Preview import outside client/shared workspace");
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = transformSync(fs.readFileSync(file, "utf8"), { loader: file.endsWith("tsx") ? "tsx" : "ts", format: "cjs", jsx: "automatic", target: "es2022" }).code;
  vm.runInNewContext(code, { module, exports: module.exports, console, Intl, Date, require(id) {
    if (id === "@/contexts/LanguageContext") return { useTranslation: () => ({ t: translation, language, dir: language === "en" ? "ltr" : "rtl" }) };
    if (id === "@/lib/trpc") throw new Error("API imports forbidden");
    if (id.startsWith("@/") || id.startsWith("@shared/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? path.join(root, "client/src", id.slice(2)) : id.startsWith("@shared/") ? path.join(root, "shared", id.slice(8)) : path.resolve(path.dirname(file), id);
      const found = [target, target + ".tsx", target + ".ts", path.join(target, "index.ts")].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!found) throw new Error("Preview import missing: " + id);
      return load(found);
    }
    return require(id);
  } }, { filename: file });
  return module.exports;
}
const Fields = load("client/src/components/purchase/PurchaseItemNeedFields.tsx").PurchaseItemNeedFields;
const timing = load("client/src/lib/purchaseItemTiming.ts");
const need = load("shared/purchaseItemNeedDate.ts");
const { Card, CardContent } = load("client/src/components/ui/card.tsx");
const { Button } = load("client/src/components/ui/button.tsx");
const { Badge } = load("client/src/components/ui/badge.tsx");
const pageSource = fs.readFileSync("client/src/pages/purchase/PurchaseOrders.tsx", "utf8");
const ast = ts.createSourceFile("PurchaseOrders.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let card;
function find(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Card" && node.openingElement.getText(ast).includes("delegate-action-item:")) card = node.getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
if (!card) throw new Error("Actual delegate card missing");
const now = new Date("2026-10-17T12:00:00Z");
const items = [
  { id: 1, itemName: "فلتر التكييف", requiredDate: "2026-10-20", requestedByName: "مدير الصيانة" },
  { id: 2, itemName: "صمام مياه", requiredDate: "2026-10-15", requestedByName: "مدير الإنشاءات" },
  { id: 3, itemName: "لمبات إنارة", requiredDate: "2026-10-17", requestedByName: "مدير الصيانة" },
].sort(need.comparePurchaseRequiredDates);
const client = await build({
  absWorkingDir: root, bundle: true, write: false, platform: "browser", target: "es2022", jsx: "automatic", minify: true, tsconfigRaw: {},
  define: { "process.env.NODE_ENV": '"production"' },
  stdin: { loader: "tsx", resolveDir: root, contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {PurchaseItemNeedFields} from './client/src/components/purchase/PurchaseItemNeedFields';
    function Preview(){ const [days,setDays]=useState(3); return <PurchaseItemNeedFields index={0} deliveryLeadDays={days} onChange={setDays} now={new Date('2026-10-17T12:00:00Z')}/>; }
    createRoot(document.getElementById('need-fields')).render(<Preview/>);
  ` },
  plugins: [{ name: "isolated-context", setup(builder) {
    builder.onResolve({ filter: /^@\/contexts\/LanguageContext$/ }, () => ({ path: "fixture-context", namespace: "fixture" }));
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.path === "@/lib/trpc" || /server[\\/]/.test(args.path)) throw new Error("API/server import forbidden");
      const base = args.path.startsWith("@/") ? path.join(root, "client/src", args.path.slice(2))
        : args.path.startsWith("@shared/") ? path.join(root, "shared", args.path.slice(8))
        : args.path.startsWith(".") ? path.resolve(args.resolveDir || root, args.path) : null;
      const found = base ? [base, base + ".tsx", base + ".ts", base + ".js"].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
        : createRequire(path.isAbsolute(args.importer || "") ? args.importer : path.join(root, "package.json")).resolve(args.path);
      if (!found || !found.startsWith(root + path.sep)) throw new Error("Preview dependency outside workspace: " + args.path);
      return { path: found, namespace: "local" };
    });
    builder.onLoad({ filter: /.*/, namespace: "local" }, args => ({
      contents: fs.readFileSync(args.path, "utf8"), resolveDir: path.dirname(args.path),
      loader: args.path.endsWith(".tsx") ? "tsx" : args.path.endsWith(".ts") ? "ts" : "js",
    }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ resolveDir: root, loader: "js", contents: `
      import ar from './client/src/i18n/ar'; import en from './client/src/i18n/en'; import ur from './client/src/i18n/ur';
      export const useTranslation=()=>{const language=document.documentElement.lang;return {t:({ar,en,ur})[language],language};};
    ` }));
  } }],
});
const js = client.outputFiles[0].text;
fs.writeFileSync(path.join(out, "purchase-lead-days-preview.js"), js);
const pages = new Map([["/purchase-lead-days-preview.js", js]]);
for (const lang of ["ar", "en", "ur"]) {
  language = lang; translation = load(`client/src/i18n/${lang}.ts`).default;
  const fieldHtml = renderToStaticMarkup(React.createElement(Fields, { index: 0, deliveryLeadDays: 3, onChange() {}, now }));
  const cards = items.map(fixture => {
    const item = { ...fixture, purchaseOrderId: 7, purchaseOrderNumber: "PR-DEMO", quantity: 3, unit: lang === "ar" ? "حبة" : "Piece", actionMode: "purchase" };
    return vm.runInNewContext(transformSync(`(${card})`, { loader: "tsx", jsx: "transform", target: "es2022" }).code, {
      React, Card, CardContent, Badge, Button, t: translation, language, item, locale: lang === "ar" ? "ar-SA" : lang === "ur" ? "ur-PK" : "en-US",
      remainingDays: need.remainingPurchaseCalendarDays(item.requiredDate, now), availableDays: null,
      ...timing, getLocalizedItemField: value => value.itemName, displayUnit: value => value, setLocation() {},
    });
  });
  const queueHtml = renderToStaticMarkup(React.createElement("div", { className: "space-y-3" }, ...cards));
  const body = `<main class="max-w-5xl mx-auto p-5 space-y-5"><p class="text-sm text-muted-foreground">معاينة محلية — بيانات تجريبية فقط، دون اتصال بالقاعدة</p><section class="rounded-xl border bg-card p-5 space-y-4"><h2 class="font-semibold">${translation.purchaseOrders.createNew}</h2><div id="need-fields">${fieldHtml}</div></section><h2 class="font-semibold">${translation.workflow.purchase.delegateItemsTab}</h2>${queueHtml}</main>`;
  const classes = Array.from(new Set(Array.from(body.matchAll(/class="([^"]*)"/g)).flatMap(m => m[1].split(/\s+/))));
  const compiler = await compile(fs.readFileSync("client/src/index.css", "utf8"), { base: path.join(root, "client/src"), onDependency() {} });
  const html = `<!doctype html><html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated lead-time preview</title><style>${compiler.build(classes)}body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><body>${body}<script src="/purchase-lead-days-preview.js"></script></body></html>`;
  fs.writeFileSync(path.join(out, `purchase-lead-days-preview-${lang}.html`), html); pages.set(`/${lang}`, html);
}
console.log("Actual controls and delegate card previews generated using fixtures only.");
if (process.argv.includes("--serve")) {
  http.createServer((request, response) => {
    const data = pages.get(request.url === "/" ? "/ar" : request.url);
    response.setHeader("Content-Type", request.url.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    response.statusCode = data ? 200 : 404; response.end(data || "Not found");
  }).listen(5199, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:5199/ar"));
}
