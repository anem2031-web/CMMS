import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const out = "docs/runtime-uat/2026-10-17";
const parsed = ts.getParsedCommandLineOfConfigFile("tsconfig.json", { incremental: false }, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); },
});
const program = ts.createProgram(parsed.fileNames, parsed.options);
const current = ts.getPreEmitDiagnostics(program).map(d => ({
  file: d.file ? path.relative(process.cwd(), d.file.fileName).replaceAll("\\", "/") : "config",
  code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
}));
const baseline = JSON.parse(fs.readFileSync(`${out}/fixes-typecheck-baseline.json`, "utf8"))
  .filter(d => !d.file.includes("parentTicketCompletion.test"));
function key(d) {
  let message = d.message;
  if (d.file === "client/src/pages/purchase/PurchaseOrderDetail.tsx" && d.code === 2339 && message.startsWith("Property 'submitForAccounting'")) {
    message = "Property 'submitForAccounting' does not exist on expanded translation type";
  }
  // Adding a nullable schema column changes only the printer's hidden-property
  // count in two existing diagnostics; retain their actual incompatible types.
  if (d.file === "server/_core/db/purchase.ts" && d.code === 2345) message = message.replace(/\.\.\. \d+ more \.\.\./g, "... <count> more ...");
  return JSON.stringify({ ...d, message });
}
const counts = new Map();
for (const d of baseline) counts.set(key(d), (counts.get(key(d)) || 0) + 1);
const added = current.filter(d => {
  const count = counts.get(key(d)) || 0;
  if (!count) return true;
  counts.set(key(d), count - 1); return false;
});
const result = { current: current.length, baseline: baseline.length, comparisonNote: "Existing dictionary expansion and two schema property-count expansions normalized; diagnostic identity and incompatible types retained.", added };
fs.writeFileSync(`${out}/purchase-lead-days-typecheck-current.json`, JSON.stringify(current, null, 2));
fs.writeFileSync(`${out}/purchase-lead-days-typecheck.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (added.length) process.exitCode = 1;
