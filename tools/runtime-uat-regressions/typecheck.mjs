import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const out = "docs/runtime-uat/2026-10-17";
const parsed = ts.getParsedCommandLineOfConfigFile("tsconfig.json", { incremental: false }, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); },
});
const changed = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(p => /\.tsx?$/.test(p));
const originals = new Map(changed.map(p => [path.resolve(p).toLowerCase(), execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8" })]));
function diagnose(baseline) {
  const host = ts.createCompilerHost(parsed.options);
  const read = host.readFile.bind(host);
  host.readFile = file => baseline && originals.has(path.resolve(file).toLowerCase()) ? originals.get(path.resolve(file).toLowerCase()) : read(file);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(d => ({
    file: d.file ? path.relative(root, d.file.fileName).replaceAll("\\", "/") : "config",
    code: d.code,
    message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  }));
}
const current = diagnose(false);
fs.writeFileSync(`${out}/fixes-typecheck-current.json`, JSON.stringify(current, null, 2));
console.log(`Current diagnostics: ${current.length}; comparing with HEAD in memory, without changing files`);
const baseline = diagnose(true);
fs.writeFileSync(`${out}/fixes-typecheck-baseline.json`, JSON.stringify(baseline, null, 2));
const key = d => JSON.stringify(d);
const counts = new Map();
for (const d of baseline) counts.set(key(d), (counts.get(key(d)) || 0) + 1);
const added = current.filter(d => {
  const count = counts.get(key(d)) || 0;
  if (!count) return true;
  counts.set(key(d), count - 1);
  return false;
});
const result = { current: current.length, baseline: baseline.length, added };
fs.writeFileSync(`${out}/fixes-typecheck-delta.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (added.length) process.exitCode = 1;
