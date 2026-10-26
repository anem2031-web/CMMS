import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs';

// Explicit source allowlist. Notifications intentionally have no source entry.
export const sources = {
 TICKET:'tickets', TICKET_ITEM:'ticket_items', TICKET_TASK:'ticket_tasks',
 TICKET_STATUS_HISTORY:'ticket_status_history', TICKET_DEPARTMENT:'ticket_departments',
 INSPECTION_RESULT:'inspection_results',
};
export async function connect() {
 const url=new URL(process.env.DATABASE_URL); url.searchParams.delete('ssl');
 if(url.pathname!=='/cmms') throw Error('Expected authorized cmms database');
 return mysql.createConnection({uri:url.toString(),ssl:{rejectUnauthorized:true},connectTimeout:15000});
}
export async function audit(db) {
 const [jobs]=await db.query(`SELECT j.id,j.entityType,j.entityId,j.fieldName,j.sourceText,j.sourceLanguage,j.targetLanguage
 FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id
 AND e.entityType=j.entityType AND e.entityId=j.entityId AND e.fieldName=j.fieldName AND e.languageCode=j.targetLanguage
 WHERE j.entityType IN ('TICKET','TICKET_ITEM','TICKET_TASK','TICKET_STATUS_HISTORY','TICKET_DEPARTMENT','INSPECTION_RESULT') AND j.status='failed' AND e.translationStatus IN ('failed','pending') ORDER BY j.id`);
 const [columns]=await db.query(`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${Object.values(sources).map(()=>'?').join(',')})`, Object.values(sources));
 const available=new Map(); for(const c of columns){if(!available.has(c.TABLE_NAME))available.set(c.TABLE_NAME,new Set());available.get(c.TABLE_NAME).add(c.COLUMN_NAME)}
 const stats={}, eligible=[], skipped=[];
 for(const type of [...new Set(jobs.map(j=>j.entityType))]){
  const group=jobs.filter(j=>j.entityType===type), table=sources[type], rows=new Map();
  if(table && available.has(table)){
   const ids=[...new Set(group.map(j=>j.entityId))];
   const fields=[...new Set(group.map(j=>j.fieldName))].filter(f=>available.get(table).has(f));
   for(let offset=0;offset<ids.length;offset+=500){
    const chunk=ids.slice(offset,offset+500);
    const [data]=await db.query(`SELECT id${fields.map(f=>', '+mysql.escapeId(f)).join('')} FROM ${mysql.escapeId(table)} WHERE id IN (${chunk.map(()=>'?').join(',')})`,chunk);
    for(const row of data)rows.set(row.id,row);
   }
  }
  stats[type]={total:group.length,eligible:0,missing:0,changed:0,unknownField:0};
  for(const j of group){
   const row=rows.get(j.entityId);
   const reason=!row?'missing':!Object.hasOwn(row,j.fieldName)?'unknownField':String(row[j.fieldName]??'').trim()!==j.sourceText.trim()?'changed':null;
   if(reason){stats[type][reason]++;skipped.push({id:j.id,entityType:type,entityId:j.entityId,fieldName:j.fieldName,reason});}
   else {stats[type].eligible++;eligible.push({id:j.id,entityType:type,entityId:j.entityId,fieldName:j.fieldName});}
  }
 }
 return {at:new Date().toISOString(),database:'cmms',stats,eligible,skipped};
}
if(process.argv[1]?.endsWith('audit.mjs')){
 const db=await connect();try{const result=await audit(db);fs.writeFileSync('tools/translation-repair/audit-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({at:result.at,stats:result.stats,totalEligible:result.eligible.length,totalSkipped:result.skipped.length},null,2));}finally{await db.end()}
}
