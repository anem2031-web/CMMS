import fs from 'node:fs';
import {transform} from 'esbuild';
const files=[...JSON.parse(fs.readFileSync('tools/maintenance-team-tickets/artifacts/warehouse-cards-before/before.json','utf8')).map(x=>x.file),'client/src/pages/maintenance-teams/TicketWarehouseMaterialCard.tsx'];
for(const file of files) await transform(fs.readFileSync(file,'utf8'),{loader:file.endsWith('tsx')?'tsx':'ts',target:'es2022',sourcefile:file});
console.log(`Syntax transforms passed for ${files.length} runtime files without loading the app.`);
