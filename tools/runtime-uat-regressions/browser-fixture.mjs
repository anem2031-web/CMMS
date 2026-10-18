import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import ts from "typescript";
import { build } from "esbuild";

// Test the real route boundary and inspection hook code in React's browser
// renderer, without importing the application, tRPC, uploads or database code.
const source = fs.readFileSync("client/src/pages/tickets/TicketDetail.tsx", "utf8");
const ast = ts.createSourceFile("TicketDetail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter(ts.isFunctionDeclaration);
const wrapper = functions.find(n => n.name?.text === "TicketDetail").getText(ast).replace("export default ", "");
const body = functions.find(n => n.name?.text === "TicketDetailContent").body;
const fields = ["inspectionNotes", "inspSeverity", "inspRootCause", "inspFindings", "inspRecommendedAction", "inspPerformedById", "loadedInspectionResultId"];
const state = body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ts.isArrayBindingPattern(d.name) && fields.includes(d.name.elements[0].getText(ast)))).map(n => n.getText(ast)).join("\n");
const load = body.statements.find(n => ts.isExpressionStatement(n) && n.getText(ast).includes("const latest = inspectionResultsList?.[0]")).getText(ast);
const entry = `import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
let routeId='1';const user={id:10};const MAINTENANCE_INSPECTION_RESULT_STATUS={DRAFT:'draft',RETURNED:'returned'};
function useRoute(){return[true,{id:routeId}]}
${wrapper}
function TicketDetailContent({ticketId}){
 const inspectionResultsList=ticketId===3?[{id:300,workflowStatus:'draft',recordedById:10,inspectionNotes:'Saved draft for ticket 3',severity:'low',rootCause:'Own saved cause',findings:'Own findings',recommendedAction:'Own action'}]:[];
 ${state}
 ${load}
 return <section><h2>Ticket {ticketId}</h2><label>Inspection notes<textarea aria-label="Inspection notes" value={inspectionNotes} onChange={e=>setInspectionNotes(e.target.value)}/></label><label>Root cause<textarea aria-label="Root cause" value={inspRootCause} onChange={e=>setInspRootCause(e.target.value)}/></label><label>Severity<select aria-label="Severity" value={inspSeverity} onChange={e=>setInspSeverity(e.target.value)}><option value="">Empty</option><option value="low">Low</option><option value="high">High</option></select></label></section>;
}
function App(){const[doc,setDoc]=useState(1);const[mode,setMode]=useState('route');const[refresh,setRefresh]=useState(0);function change(id){routeId=String(id);setDoc(id)}return <><h1>Isolated ticket form regression</h1><p>Actual route boundary and inspection state/loading code from TicketDetail.tsx. Fixtures only. No API or database.</p><button onClick={()=>{setMode(mode==='route'?'embedded':'route');change(1)}}>Mode: {mode}</button>{[1,2,3].map(id=><button key={id} onClick={()=>change(id)}>Ticket {id}</button>)}<button onClick={()=>setRefresh(refresh+1)}>Refresh same ticket</button><TicketDetail embeddedTicketId={mode==='embedded'?doc:undefined}/></>}
createRoot(document.getElementById('root')).render(<App/>);`;
const root = process.cwd();
const result = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: "ticket-form-regression.tsx", loader: "tsx" },
  absWorkingDir: root, tsconfigRaw: {}, bundle: true, platform: "browser", format: "iife", write: false, jsx: "automatic",
  plugins: [{ name: "workspace-only-resolution", setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      const resolveFrom = args.resolveDir || root;
      const resolved = createRequire(path.join(resolveFrom, "package.json")).resolve(args.path);
      if (!resolved.startsWith(root + path.sep)) throw new Error("Fixture dependency must stay in the workspace");
      return { path: resolved };
    });
  } }],
});
const html = '<!doctype html><html><meta charset="utf-8"><title>Isolated ticket form regression</title><style>body{font:16px Arial;max-width:800px;margin:20px auto;padding:20px}button{padding:10px;margin:6px}label{display:block;margin:16px}textarea{display:block;width:90%;height:65px}select{padding:10px}</style><div id="root"></div><script src="/fixture.js"></script></html>';
const server = http.createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(result.outputFiles[0].contents); }
  else if (req.url === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); }
  else { res.statusCode = 404; res.end(); }
});
server.listen(5199, "127.0.0.1", () => console.log("Isolated fixture ready: http://127.0.0.1:5199 — no API/database"));
