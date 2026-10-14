import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  dir = "tools/observer/artifacts/correction";
const norm = s => path.resolve(s).replaceAll("\\", "/").toLowerCase();
const snapshots = JSON.parse(fs.readFileSync(`${dir}/before.json`, "utf8"));
const overrides = new Map(
  snapshots.map(x => [norm(x.file), fs.readFileSync(x.backup, "utf8")])
);
const added = [
  "shared/observer-native-reads.ts",
  "shared/observer-view.ts",
  "server/_core/authz/observer-read-scope.ts",
  "client/src/components/system/observer-controls.ts",
  "client/src/components/system/ObserverReadOnlyBoundary.tsx",
  "client/src/lib/observer-link.ts",
];
const newFiles = new Set(added.map(norm));
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile),
  parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
function check(before) {
  const host = ts.createCompilerHost(parsed.options),
    read = host.readFile.bind(host),
    exists = host.fileExists.bind(host);
  host.readFile = f =>
    before && overrides.has(norm(f)) ? overrides.get(norm(f)) : read(f);
  host.fileExists = f => (before && overrides.has(norm(f))) || exists(f);
  const names = before
    ? [
        ...new Set([
          ...parsed.fileNames.filter(f => !newFiles.has(norm(f))),
          ...snapshots.map(x => path.resolve(x.file)),
        ]),
      ]
    : parsed.fileNames;
  const program = ts.createProgram({
    rootNames: names,
    options: { ...parsed.options, incremental: false },
    host,
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map(
      d =>
        `${d.file ? path.relative(root, d.file.fileName).replaceAll("\\", "/") : "<config>"}: TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
    )
    .sort();
}
const before = check(true);
global.gc?.();
const after = check(false);
const result = {
  before: before.length,
  after: after.length,
  introduced: after.filter(x => !before.includes(x)),
  resolved: before.filter(x => !after.includes(x)),
};
fs.writeFileSync(
  `${dir}/typecheck-comparison.json`,
  JSON.stringify(result, null, 2)
);
console.log(JSON.stringify(result));
if (result.introduced.length) process.exitCode = 1;
