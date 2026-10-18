import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { compile } from "@tailwindcss/node";
import ts from "typescript";

// Actual UI with explicit fixtures. No app startup, API, credentials or database module.
const root = process.cwd(), out = path.join(root, "docs/runtime-uat/2026-10-17");
const require = createRequire(import.meta.url), cache = new Map();
let language = "ar", translation;
function load(file) {
  file = path.resolve(root, file);
  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}server${path.sep}`)) throw new Error("Preview import outside client/shared workspace");
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = transformSync(fs.readFileSync(file, "utf8"), { loader: file.endsWith("tsx") ? "tsx" : "ts", format: "cjs", jsx: "automatic", target: "es2022" }).code;
  vm.runInNewContext(code, { module, exports: module.exports, console, require(id) {
    if (id === "@/contexts/LanguageContext") return { useTranslation: () => ({ t: translation, language, dir: language === "en" ? "ltr" : "rtl" }) };
    if (id === "@/lib/trpc") throw new Error("API imports forbidden in this preview");
    if (id.startsWith("@/") || id.startsWith("@shared/") || id.startsWith(".")) {
      const target = id.startsWith("@/") ? path.join(root, "client/src", id.slice(2)) : id.startsWith("@shared/") ? path.join(root, "shared", id.slice(8)) : path.resolve(path.dirname(file), id);
      const found = [target, target + ".tsx", target + ".ts", path.join(target, "index.ts")].find(value => fs.existsSync(value) && fs.statSync(value).isFile());
      if (!found) throw new Error("Preview dependency missing: " + id);
      return load(found);
    }
    return require(id);
  } }, { filename: file });
  return module.exports;
}
const Field = load("client/src/components/purchase/CatalogStockField.tsx").CatalogStockField;
const Button = load("client/src/components/ui/button.tsx").Button;
const source = fs.readFileSync("client/src/pages/purchase/PurchaseOrders.tsx", "utf8");
const ast = ts.createSourceFile("PurchaseOrders.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let tabs;
function find(node) {
  if (ts.isJsxElement(node) && node.openingElement.getText(ast).includes('className="flex gap-2 flex-wrap"') && node.getText(ast).includes("actionableTab")) tabs = node.getText(ast);
  ts.forEachChild(node, find);
}
find(ast);
if (!tabs) throw new Error("Actual purchase tabs missing");
const units = [{ id: 1, nameAr: "حبة", nameEn: "Piece" }];
const stock = { catalogItemId: 1, totals: [{ unit: "حبة", quantity: 30 }], warehouses: [
  { warehouseId: 1, nameAr: "المستودع الرئيسي", nameEn: "Main warehouse", quantity: 20, unit: "حبة" },
  { warehouseId: 2, nameAr: "مخزن التكييف", nameEn: "HVAC warehouse", quantity: 7, unit: "حبة" },
  { warehouseId: 3, nameAr: "مخزن الدهان", nameEn: "Painting warehouse", quantity: 3, unit: "حبة" },
] };
const pages = new Map();
for (const lang of ["ar", "en", "ur"]) {
  language = lang; translation = load(`client/src/i18n/${lang}.ts`).default;
  const tabTree = vm.runInNewContext(ts.transpileModule(`(${tabs})`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText, {
    React, Button, History: () => null, Truck: () => null, user: { role: "delegate" }, t: translation, view: "items", setView: () => {},
    isDelegatePricingActionRole: true, canAccessMyItemsTracking: true, canAccessSupplyTracking: true, actionableDisplayCount: 0, delegateActionableItemsCount: 2, myRequestedItemsCount: 0, supplyTrackingCount: 3,
  });
  const body = renderToStaticMarkup(React.createElement("main", { className: "max-w-3xl mx-auto p-4 space-y-6" },
    React.createElement("p", { className: "text-sm text-muted-foreground" }, "معاينة محلية — بيانات تجريبية فقط، دون اتصال بالقاعدة"),
    React.createElement("nav", { className: "flex gap-4" }, ...["ar", "en", "ur"].map(value => React.createElement("a", { href: `/${value}`, key: value, className: "underline text-sm text-primary" }, value))),
    React.createElement("section", { className: "rounded-xl border bg-card p-5 space-y-4" },
      React.createElement("h1", { className: "text-lg font-semibold" }, translation.purchaseOrders.title),
      React.createElement("p", {}, language === "ar" ? "لمبات LED — عينة معاينة" : "LED lamps — preview sample"),
      React.createElement(Field, { stock, units, loading: false, failed: false, canRead: true }),
      React.createElement("div", { className: "min-h-28" })),
    React.createElement("section", { className: "rounded-xl border bg-card p-5 space-y-4" }, tabTree,
      React.createElement("p", { className: "text-sm" }, translation.workflow.purchase.delegateNeedsPurchase)),
    React.createElement("section", { className: "rounded-xl border bg-card p-5 space-y-2" },
      React.createElement("label", { className: "text-sm font-medium", htmlFor: "preview-reason" }, translation.tickets.reason),
      React.createElement("input", { id: "preview-reason", className: "w-full h-9 rounded-md border px-3 bg-background", value: "", readOnly: true }))));
  const classes = Array.from(new Set(Array.from(body.matchAll(/class="([^"]*)"/g)).flatMap(match => match[1].split(/\s+/))));
  const compiler = await compile(fs.readFileSync("client/src/index.css", "utf8"), { base: path.join(root, "client/src"), onDependency() {} });
  const html = `<!doctype html><html lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated purchase UI preview</title><style>${compiler.build(classes)}body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><body>${body}</body></html>`;
  fs.writeFileSync(path.join(out, `purchase-ux-preview-${lang}.html`), html);
  pages.set(`/${lang}`, html);
}
console.log("Actual UI previews generated with test quantities only; no API/database imports.");
if (process.argv.includes("--serve")) {
  http.createServer((request, response) => {
    const html = pages.get(request.url === "/" ? "/ar" : request.url);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.statusCode = html ? 200 : 404; response.end(html || "Not found");
  }).listen(5199, "127.0.0.1", () => console.log("Isolated preview: http://127.0.0.1:5199/ar"));
}
