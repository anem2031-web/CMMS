import fs from "node:fs";
import crypto from "node:crypto";
import { transformSync } from "esbuild";
const artifacts = "tools/observer/artifacts/correction";
const files = [
  ...JSON.parse(
    fs.readFileSync("tools/observer/artifacts/before/before.json", "utf8")
  ).map(x => x.file),
  ...JSON.parse(fs.readFileSync(`${artifacts}/before.json`, "utf8"))
    .map(x => x.file)
    .filter(fs.existsSync),
  "shared/observer-policy.ts",
  "shared/observer-native-reads.ts",
  "shared/observer-view.ts",
  "server/_core/authz/observer-guard.ts",
  "server/_core/authz/observer-read-scope.ts",
  "client/src/components/system/observer-controls.ts",
  "client/src/components/system/ObserverReadOnlyBoundary.tsx",
  "client/src/lib/observer-link.ts",
];
const result = [...new Set(files)].map(file => {
  const text = fs.readFileSync(file, "utf8");
  transformSync(text, {
    loader: file.endsWith("tsx") ? "tsx" : "ts",
    jsx: "automatic",
    format: "esm",
    sourcefile: file,
    logLevel: "silent",
  });
  return { file, hash: crypto.createHash("sha256").update(text).digest("hex") };
});
fs.writeFileSync(`${artifacts}/after.json`, JSON.stringify(result, null, 2));
console.log(
  `Syntax transformation passed for ${result.length} runtime sources; no application module or database loaded.`
);
