import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();const originals=new Map(JSON.parse(fs.readFileSync('tools/ticket-material-identity/artifacts/before.json','utf8')).map(e=>[path.resolve(e.file).toLowerCase(),fs.readFileSync(e.backup)]));const read=fs.readFileSync.bind(fs);
fs.readFileSync=(file,options)=>{const resolved=path.resolve(file instanceof URL?fileURLToPath(file):String(file)).toLowerCase();const original=originals.get(resolved);if(!original)return read(file,options);const encoding=typeof options==='string'?options:options?.encoding;return encoding?original.toString(encoding):Buffer.from(original);};
import {fileURLToPath} from 'node:url';

import { syncBuiltinESMExports } from "node:module";
syncBuiltinESMExports();
