import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { connect, sources } from './audit.mjs';
import { retryFailedJobs } from '../../server/services/translation/translationEngine';

// One-off maintenance runner: only IDs audited from existing ticket sources.
// Uses the application's guarded queue; never touches notifications/business states.
const max = Number(process.argv.find(a => a.startsWith('--max='))?.split('=')[1] ?? 20);
if (!Number.isInteger(max) || max < 1 || max > 4000) throw Error('Invalid limit');
const snapshot = JSON.parse(fs.readFileSync('tools/translation-repair/audit-result.json', 'utf8'));
if (snapshot.database !== 'cmms') throw Error('Wrong snapshot database');
const db = await connect();
const summary: any = { startedAt: new Date().toISOString(), completed: [], skipped: [], failed: [], status: 'running' };
const report = 'tools/translation-repair/run-result.json';
const save = () => fs.writeFileSync(report, JSON.stringify(summary, null, 2));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
save();
try {
 let attempted = 0;
 for (const candidate of snapshot.eligible) {
  if (attempted >= max) break;
  const table = sources[candidate.entityType];
  if (!table || !/^[A-Za-z][A-Za-z0-9]*$/.test(candidate.fieldName)) throw Error('Outside approved ticket scope');
  // Fresh source + current translation check at every retry boundary.
  const [rows]: any = await db.query(`SELECT j.id FROM translation_jobs j
   JOIN entity_translations e ON e.translationJobId=j.id AND e.entityType=j.entityType
    AND e.entityId=j.entityId AND e.fieldName=j.fieldName AND e.languageCode=j.targetLanguage
   JOIN ${mysql.escapeId(table)} s ON s.id=j.entityId
   WHERE j.id=? AND j.entityType=? AND j.entityId=? AND j.fieldName=? AND j.status='failed'
    AND e.translationStatus IN ('failed','pending')
    AND BINARY TRIM(s.${mysql.escapeId(candidate.fieldName)})=BINARY TRIM(j.sourceText)`,
   [candidate.id,candidate.entityType,candidate.entityId,candidate.fieldName]);
  if (!rows.length) { summary.skipped.push(candidate.id); continue; }
  attempted++;
  const count = await retryFailedJobs(candidate.entityType, candidate.id);
  if (count !== 1) { summary.skipped.push(candidate.id); continue; }
  const deadline = Date.now()+240_000;
  let success = false;
  while (Date.now()<deadline) {
   await sleep(2000);
   const [status]: any = await db.query(`SELECT j.status,e.translationStatus,e.translatedText
    FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id
    WHERE j.id=? AND j.entityType=?`,[candidate.id,candidate.entityType]);
   if (status[0]?.status==='completed' && status[0]?.translationStatus==='completed' && status[0]?.translatedText?.trim()) {success=true;break;}
   if (!status.length || status[0]?.status==='failed') break;
  }
  if (!success) { summary.failed.push(candidate.id); summary.status='stopped_on_failure'; save(); break; }
  summary.completed.push(candidate.id);save();
  console.log(JSON.stringify({completed:summary.completed.length,jobId:candidate.id,entityType:candidate.entityType}));
  if (attempted % 20 === 0) await sleep(3000);
 }
 if(summary.status==='running') summary.status='batch_finished';
 summary.finishedAt=new Date().toISOString();save();
 console.log(JSON.stringify({status:summary.status,completed:summary.completed.length,skipped:summary.skipped.length,failed:summary.failed.length}));
} catch (error: any) {
 summary.status='stopped_on_error';
 summary.errorCode=error?.code || error?.name || 'Error';
 summary.finishedAt=new Date().toISOString();save();
 console.error(JSON.stringify({status:summary.status,errorCode:summary.errorCode}));
 await db.end();process.exit(1);
} finally { await db.end(); }
process.exit(summary.failed.length ? 1 : 0);
