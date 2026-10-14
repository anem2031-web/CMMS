import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const artifacts = path.join(process.cwd(), "tools/catalog-picker/artifacts");
const server = http.createServer((request, response) => {
  const file = request.url === "/" ? "preview.html" : request.url === "/styles.css" ? "preview.css" : null;
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": file.endsWith("css") ? "text/css; charset=utf-8" : "text/html; charset=utf-8" });
  response.end(fs.readFileSync(path.join(artifacts, file)));
});
server.listen(0, "127.0.0.1", () => console.log(`ISOLATED_PREVIEW=http://127.0.0.1:${server.address().port}/`));
process.stdin.setEncoding("utf8");
process.stdin.on("data", text => { if (text.trim() === "stop") server.close(() => process.exit(0)); });
