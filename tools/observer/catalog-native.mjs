import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache = new Map();
const resolve = (base, name) => {
  const full = path.resolve(path.dirname(base), name);
  for (const f of [full + ".ts", full + ".tsx", path.join(full, "index.ts")])
    if (fs.existsSync(f)) return f;
  throw Error("Missing static import " + full);
};
function module(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    ),
    m = { file, ast, defs: new Map(), imports: new Map() };
  cache.set(file, m);
  for (const st of ast.statements) {
    if (
      ts.isImportDeclaration(st) &&
      st.moduleSpecifier.text.startsWith(".") &&
      st.importClause?.namedBindings &&
      ts.isNamedImports(st.importClause.namedBindings)
    )
      for (const b of st.importClause.namedBindings.elements)
        m.imports.set(b.name.text, {
          file: resolve(file, st.moduleSpecifier.text),
          name: b.propertyName?.text ?? b.name.text,
        });
    if (
      ts.isExportDeclaration(st) &&
      st.moduleSpecifier?.text.startsWith(".") &&
      st.exportClause &&
      ts.isNamedExports(st.exportClause)
    )
      for (const b of st.exportClause.elements)
        m.imports.set(b.name.text, {
          file: resolve(file, st.moduleSpecifier.text),
          name: b.propertyName?.text ?? b.name.text,
        });
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name)) m.defs.set(d.name.text, d.initializer);
    if (ts.isFunctionDeclaration(st) && st.name) m.defs.set(st.name.text, st);
  }
  return m;
}
function symbol(m, name) {
  if (m.defs.has(name)) return { m, node: m.defs.get(name) };
  const ref = m.imports.get(name);
  if (ref) return symbol(module(ref.file), ref.name);
  throw Error(`Unknown symbol ${m.file} ${name}`);
}
function unwrap(m, node) {
  if (ts.isIdentifier(node)) {
    const ref = symbol(m, node.text);
    return unwrap(ref.m, ref.node);
  }
  if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
    let ret;
    function visit(n) {
      if (
        ts.isReturnStatement(n) &&
        n.expression &&
        ts.isCallExpression(n.expression) &&
        (n.expression.expression.getText(m.ast) === "router" ||
          (ts.isPropertyAccessExpression(n.expression.expression) &&
            ["query", "mutation", "subscription"].includes(
              n.expression.expression.name.text
            )))
      )
        ret = n.expression;
      else ts.forEachChild(n, visit);
    }
    visit(node.body);
    if (ret) return unwrap(m, ret);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text !== "router"
  )
    return unwrap(m, node.expression);
  return { m, node };
}
const rows = [];
function walk(m, node, prefix = "") {
  const un = unwrap(m, node);
  m = un.m;
  node = un.node;
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ["query", "mutation", "subscription"].includes(node.expression.name.text)
  ) {
    const callback = node.arguments[0],
      calls = [];
    function collect(n) {
      if (ts.isCallExpression(n)) calls.push(n.expression.getText(m.ast));
      ts.forEachChild(n, collect);
    }
    if (callback) collect(callback);
    rows.push({
      path: prefix,
      type: node.expression.name.text,
      file: path.relative(process.cwd(), m.file).replaceAll("\\", "/"),
      line: m.ast.getLineAndCharacterOfPosition(node.getStart(m.ast)).line + 1,
      calls,
      body: callback?.getText(m.ast) ?? "",
    });
    return;
  }
  if (ts.isCallExpression(node) && node.expression.getText(m.ast) === "router")
    node = node.arguments[0];
  if (!ts.isObjectLiteralExpression(node))
    throw Error("Not router: " + node.getText(m.ast).slice(0, 80));
  for (const prop of node.properties) {
    if (ts.isSpreadAssignment(prop)) {
      const txt = prop.expression.getText(m.ast),
        name = txt.match(/^(\w+)\._def\.procedures$/)?.[1];
      if (!name) throw Error("Unknown spread " + txt);
      walk(m, ts.factory.createIdentifier(name), prefix);
      continue;
    }
    const key = prop.name.getText(m.ast).replace(/^['"]|['"]$/g, ""),
      expr = ts.isShorthandPropertyAssignment(prop)
        ? prop.name
        : prop.initializer;
    const route = prefix ? prefix + "." + key : key;
    if (
      ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      ["query", "mutation", "subscription"].includes(expr.expression.name.text)
    ) {
      const callback = expr.arguments[0],
        calls = [];
      function collect(n) {
        if (ts.isCallExpression(n)) calls.push(n.expression.getText(m.ast));
        ts.forEachChild(n, collect);
      }
      if (callback) collect(callback);
      rows.push({
        path: route,
        type: expr.expression.name.text,
        file: path.relative(process.cwd(), m.file).replaceAll("\\", "/"),
        line:
          m.ast.getLineAndCharacterOfPosition(prop.getStart(m.ast)).line + 1,
        calls,
        body: callback?.getText(m.ast) ?? "",
      });
    } else walk(m, expr, route);
  }
}
walk(
  module("server/routers/index.ts"),
  ts.factory.createIdentifier("appRouter")
);
fs.writeFileSync(
  "tools/observer/artifacts/correction/procedures.json",
  JSON.stringify(rows, null, 2)
);
fs.writeFileSync(
  "tools/observer/artifacts/correction/queries.txt",
  rows
    .filter(r => r.type === "query")
    .map(
      r => `${r.path} ${r.file}:${r.line}\n${r.calls.join(" | ")}\n${r.body}\n`
    )
    .join("\n")
);
console.log(
  JSON.stringify({
    all: rows.length,
    query: rows.filter(r => r.type === "query").length,
  })
);
