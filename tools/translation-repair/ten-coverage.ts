import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import {connect,sources} from './audit.mjs';
import {ENTITY_FIELD_MAP} from '../../server/services/translation/translationEngine';
import {detectLanguage} from '../../server/services/translation/translation';
const ids=JSON.parse(fs.readFileSync('tools/translation-repair/ten-recent-result.json','utf8')).tickets.map((t:any)=>t.id);
if(ids.length!==10)throw Error('Expected exactly ten selected tickets');
const db=await connect(); const missing:any[]=[], counts:any={};
try {
 for(const [type,table] of Object.entries(sources)){
  const parent=type==='TICKET'?'id':'ticketId';
  const [records]:any=await db.query(`SELECT * FROM ${mysql.escapeId(table as string)} WHERE ${mysql.escapeId(parent)} IN (${ids.map(()=>'?').join(',')})`,ids);
  if(!records.length)continue;
  const [translations]:any=await db.query(`SELECT entityId,fieldName,languageCode,translationStatus FROM entity_translations WHERE entityType=? AND entityId IN (${records.map(()=>'?').join(',')})`,[type,...records.map((r:any)=>r.id)]);
  for(const r of records)for(const field of ENTITY_FIELD_MAP[type]){
   const text=r[field];if(typeof text!=='string'||!text.trim())continue;
   const sourceLanguage=await detectLanguage(text);
   for(const language of ['ar','en','ur'].filter(l=>l!==sourceLanguage)){
    const existing=translations.find((e:any)=>e.entityId===r.id&&e.fieldName===field&&e.languageCode===language);
    const status=existing?.translationStatus||'missing';counts[`${type}:${status}`]=(counts[`${type}:${status}`]||0)+1;
    if(!existing)missing.push({entityType:type,entityId:r.id,ticketId:r[parent],fieldName:field,sourceLanguage,targetLanguage:language});
   }
  }
 }
 const report={at:new Date().toISOString(),tickets:ids,counts,missing};
 fs.writeFileSync('tools/translation-repair/ten-coverage.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({counts,missing:missing.length}));
}finally{await db.end()}
process.exit(0);
