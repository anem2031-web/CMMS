import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const domains = [
  "shared/maintenance-team-tickets",
  "server/maintenance-team-tickets",
  "client/src/features/maintenance-team-tickets",
];
async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const all = await Promise.all(
    entries.map(e =>
      e.isDirectory()
        ? sourceFiles(path.join(directory, e.name))
        : /\.tsx?$/.test(e.name)
          ? [path.join(directory, e.name)]
          : []
    )
  );
  return all.flat();
}
test("runtime import graph cannot reach database, root routers, scheduled jobs, network or live env", async () => {
  for (const domain of domains) {
    for (const file of await sourceFiles(path.join(root, domain))) {
      if (/\.node\.tsx?$/.test(file)) continue;
      const source = await readFile(file, "utf8");
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true
      );
      const imports = ast.statements.filter(ts.isImportDeclaration);
      for (const statement of imports) {
        const target = (statement.moduleSpecifier as ts.StringLiteral).text;
        assert.ok(
          !/mysql|drizzle|dotenv|axios|trpc/.test(target),
          `${file}: forbidden dependency ${target}`
        );
        if (target.startsWith(".")) {
          const resolved = path.resolve(path.dirname(file), target);
          assert.ok(
            domains.some(d =>
              resolved.startsWith(path.join(root, d) + path.sep)
            ),
            `${file}: dependency escapes independent module ${target}`
          );
        } else
          assert.ok(
            ["react", "react-dom/client"].includes(target),
            `${file}: unexpected runtime dependency ${target}`
          );
      }
      assert.doesNotMatch(
        source,
        /\bgetDb\s*\(|\bfetch\s*\(|process\.env|XMLHttpRequest|\bWebSocket\s*\(|import\s*\(|\brequire\s*\(/,
        `${file}: live effect reachable`
      );
    }
  }
});
test("SQL package is additive, has one statement per file, no current-table foreign keys", async () => {
  const dir = path.join(root, "docs/maintenance-team-tickets/sql");
  const files = (await readdir(dir)).filter(f => f.endsWith(".sql"));
  assert.equal(files.length, 20);
  for (const file of files) {
    const sql = (await readFile(path.join(dir, file), "utf8"))
      .replace(/^--.*$/gm, "")
      .trim();
    assert.equal(
      (sql.match(/;/g) ?? []).length,
      1,
      `${file}: one statement only`
    );
    assert.doesNotMatch(
      sql,
      /\b(ALTER|DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s+(TABLE|FROM|INTO|tickets|users|inventory|pmv2_)/i,
      `${file}: existing data mutation`
    );
    if (file.includes("_create_")) {
      assert.match(sql, /^CREATE TABLE (maintenance_|ticket_team_)/);
      for (const match of sql.matchAll(/REFERENCES\s+(\w+)/gi))
        assert.match(match[1], /^(maintenance_|ticket_team_)/);
    } else assert.match(sql, /^(SELECT|SHOW CREATE TABLE)\b/);
  }
});
