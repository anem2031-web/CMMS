/**
 * Stage 0.6 — Prove INSERT root cause
 * 
 * Uses Drizzle's .toSQL() to extract the exact generated INSERT statement
 * WITHOUT executing it against the DB.
 * 
 * Also queries the live DB for the exact column order in the assets table.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { assets } from './drizzle/schema.ts';

const DB_CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4QLyZNrgTT18fMs.root',
  password: 'P4U13RrqYbofEO2y',
  database: 'cmms',
  ssl: { rejectUnauthorized: true },
};

// A realistic sample payload matching what the frontend sends for a new asset
const samplePayload = {
  assetNumber: 'AST-00001',
  name: 'Test Asset',
  description: 'Test description',
  category: 'Equipment',
  brand: 'TestBrand',
  model: 'TestModel',
  serialNumber: 'SN-12345',
  siteId: 300001,
  sectionId: 90001,
  locationDetail: 'Floor 1',
  status: 'active',
  purchaseCost: '1000.00',
  notes: 'Test notes',
  originalLanguage: 'ar',
  createdById: 1,
};

async function main() {
  // ── 1. Extract Drizzle-generated SQL using .toSQL() ──
  // We need a drizzle instance to call .toSQL() — use a dummy connection
  const pool = await mysql.createPool(DB_CONFIG);
  const db = drizzle(pool);

  const query = db.insert(assets).values(samplePayload);
  const { sql: generatedSQL, params } = query.toSQL();

  console.log('\n=== DRIZZLE GENERATED INSERT SQL ===');
  console.log(generatedSQL);
  console.log('\n=== BOUND PARAMETERS ===');
  console.log(JSON.stringify(params, null, 2));

  // ── 2. Parse the column names from the generated SQL ──
  const colMatch = generatedSQL.match(/INSERT INTO `assets` \(([^)]+)\)/);
  if (colMatch) {
    const cols = colMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
    console.log('\n=== DRIZZLE INSERT COLUMN ORDER ===');
    cols.forEach((col, i) => {
      console.log(`  [${i + 1}] ${col} = ${JSON.stringify(params[i])}`);
    });
  } else {
    console.log('\nWARNING: Could not parse column names from SQL — may be positional INSERT');
    console.log('Raw SQL:', generatedSQL);
  }

  // ── 3. Get actual DB column order ──
  const conn = await mysql.createConnection(DB_CONFIG);
  const [dbCols] = await conn.execute('SHOW COLUMNS FROM assets');
  console.log('\n=== ACTUAL DB COLUMN ORDER ===');
  dbCols.forEach((col, i) => {
    console.log(`  [${i + 1}] ${col.Field}  (${col.Type}, ${col.Null === 'YES' ? 'nullable' : 'NOT NULL'}, default=${JSON.stringify(col.Default)})`);
  });

  // ── 4. Side-by-side comparison ──
  if (colMatch) {
    const drizzleCols = colMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
    const dbColNames = dbCols.map(c => c.Field);
    
    console.log('\n=== SIDE-BY-SIDE COMPARISON (Drizzle INSERT cols vs DB cols) ===');
    const maxLen = Math.max(drizzleCols.length, dbColNames.length);
    for (let i = 0; i < maxLen; i++) {
      const d = drizzleCols[i] || '(none)';
      const b = dbColNames[i] || '(none)';
      const match = d === b ? '✓' : '✗ MISMATCH';
      console.log(`  [${i + 1}] Drizzle: ${d.padEnd(25)} DB: ${b.padEnd(25)} ${match}`);
    }
  }

  // ── 5. Check if INSERT is named or positional ──
  console.log('\n=== INSERT TYPE ANALYSIS ===');
  if (generatedSQL.includes('INSERT INTO `assets` (')) {
    console.log('  INSERT TYPE: NAMED-COLUMN (explicit column list)');
    console.log('  Physical column order in DB does NOT affect correctness.');
    console.log('  Column-order mismatch hypothesis: DISPROVED');
    console.log('  The INSERT failure must have a different root cause.');
  } else {
    console.log('  INSERT TYPE: POSITIONAL (no explicit column list)');
    console.log('  Physical column order in DB DOES affect correctness.');
    console.log('  Column-order mismatch hypothesis: CONFIRMED');
  }

  await conn.end();
  await pool.end();
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
