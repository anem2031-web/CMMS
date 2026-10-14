import fs from 'node:fs';
import {transform} from 'esbuild';
const originals=JSON.parse(fs.readFileSync('tools/maintenance-team-tickets/artifacts/warehouse-extra-before/before.json','utf8')).map(x=>x.file);
const files=[...originals,'shared/maintenance-team-tickets/purchase-quantities.ts','client/src/pages/maintenance-teams/WarehousePurchaseQuantities.tsx'];
for(const file of files) await transform(fs.readFileSync(file,'utf8'),{loader:file.endsWith('tsx')?'tsx':'ts',target:'es2022',sourcefile:file});
console.log(`Syntax transforms passed: ${files.length} runtime files; no application imports.`);
