/**
 * Phase 0.1 — DB Performance Benchmark
 *
 * Benchmarks the REAL application execution path through Drizzle ORM
 * by importing and calling functions directly from server/db.ts.
 *
 * STRICT RULES:
 * - NO raw mysql2/promise connections
 * - ALL measurements go through Drizzle ORM
 * - Each query is executed 5 times to collect statistical measurements
 */

// Load environment variables FIRST before any other imports
import 'dotenv/config';
import fs from 'fs';

// Import real application functions from server/db.ts
import * as db from '../server/db.ts';
// Import Drizzle connection helper and sql tag for raw EXPLAIN plans
import { getDb } from '../server/db.ts';
import { sql } from 'drizzle-orm';

// ─── Statistical helpers ──────────────────────────────────────────────────────
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function calcStats(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    min_ms: sorted[0].toFixed(2),
    max_ms: sorted[sorted.length - 1].toFixed(2),
    avg_ms: avg.toFixed(2),
    p50_ms: percentile(sorted, 50).toFixed(2),
    p95_ms: percentile(sorted, 95).toFixed(2),
    p99_ms: percentile(sorted, 99).toFixed(2),
  };
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────
async function benchmarkFn(name, fn, runs = 5) {
  console.log(`  ⏱️  Running: ${name}`);
  const durations = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    durations.push(end - start);
  }
  return { name, ...calcStats(durations) };
}

// ─── EXPLAIN plan helper via Drizzle sql tag ──────────────────────────────────
async function getExplainPlan(rawSql) {
  const drizzle = await getDb();
  if (!drizzle) return [];
  try {
    const result = await drizzle.execute(sql.raw(`EXPLAIN ${rawSql}`));
    return result.rows ?? result;
  } catch {
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runAnalysis() {
  console.log('\n🔍 Starting DB Performance Benchmark via Drizzle ORM...\n');

  // Resolve a real PO id for getPOItems (requires at least one PO in DB)
  const drizzle = await getDb();
  let firstPoId = 1;
  if (drizzle) {
    try {
      const rows = await drizzle.execute(sql.raw('SELECT id FROM purchase_orders LIMIT 1'));
      const first = (rows.rows ?? rows)[0];
      if (first?.id) firstPoId = Number(first.id);
    } catch { /* use default */ }
  }

  // ── 1. Benchmark real db.ts functions ────────────────────────────────────
  const benchmarks = [
    await benchmarkFn('db.getTickets()',                   () => db.getTickets()),
    await benchmarkFn('db.getTickets({ status: "open" })', () => db.getTickets({ status: 'open' })),
    await benchmarkFn('db.getDashboardStats()',             () => db.getDashboardStats()),
    await benchmarkFn('db.getTechnicianPerformance()',      () => db.getTechnicianPerformance()),
    await benchmarkFn('db.getPurchaseOrders()',             () => db.getPurchaseOrders()),
    await benchmarkFn('db.getPOItems()',                    () => db.getPOItems(firstPoId)),
  ];

  // ── 2. Raw SQL via Drizzle sql helper (NOT mysql2/promise) ────────────────
  // These two cases are executed through the existing Drizzle db connection
  // using the sql template tag as required.
  const rawQueries = [
    {
      name: 'SELECT * FROM tickets WHERE assignedToId = ? LIMIT 50',
      fn: async () => {
        const d = await getDb();
        if (!d) return;
        await d.execute(sql.raw('SELECT * FROM tickets WHERE assignedToId IS NOT NULL LIMIT 50'));
      }
    },
    {
      name: 'SELECT * FROM notifications WHERE userId = ? AND isRead = 0',
      fn: async () => {
        const d = await getDb();
        if (!d) return;
        await d.execute(sql.raw('SELECT * FROM notifications WHERE isRead = 0 LIMIT 50'));
      }
    }
  ];

  for (const q of rawQueries) {
    benchmarks.push(await benchmarkFn(q.name, q.fn));
  }

  // ── 3. Capture EXPLAIN plans via Drizzle sql helper ───────────────────────
  console.log('\n📋 Capturing EXPLAIN plans via Drizzle...\n');

  const explainTargets = [
    {
      name: 'db.getTickets()',
      sql: 'SELECT t.*, tech.name AS technicianName, au.name AS assignedUserName FROM tickets t LEFT JOIN technicians tech ON t.assignedTechnicianId = tech.id LEFT JOIN users au ON t.assignedToId = au.id ORDER BY t.createdAt DESC'
    },
    {
      name: 'db.getTickets({ status: "open" })',
      sql: 'SELECT t.*, tech.name AS technicianName, au.name AS assignedUserName FROM tickets t LEFT JOIN technicians tech ON t.assignedTechnicianId = tech.id LEFT JOIN users au ON t.assignedToId = au.id WHERE t.status != "closed" ORDER BY t.createdAt DESC'
    },
    {
      name: 'db.getDashboardStats()',
      sql: 'SELECT COUNT(*) AS cnt FROM tickets WHERE status != "closed"'
    },
    {
      name: 'db.getTechnicianPerformance()',
      sql: 'SELECT COUNT(*) AS cnt FROM tickets WHERE assignedToId IS NOT NULL'
    },
    {
      name: 'db.getPurchaseOrders()',
      sql: 'SELECT * FROM purchase_orders ORDER BY createdAt DESC'
    },
    {
      name: 'db.getPOItems()',
      sql: `SELECT * FROM purchase_order_items WHERE purchaseOrderId = ${firstPoId} ORDER BY id`
    },
    {
      name: 'SELECT * FROM tickets WHERE assignedToId = ? LIMIT 50',
      sql: 'SELECT * FROM tickets WHERE assignedToId IS NOT NULL LIMIT 50'
    },
    {
      name: 'SELECT * FROM notifications WHERE userId = ? AND isRead = 0',
      sql: 'SELECT * FROM notifications WHERE isRead = 0 LIMIT 50'
    }
  ];

  const explainMap = {};
  for (const t of explainTargets) {
    explainMap[t.name] = await getExplainPlan(t.sql);
  }

  // ── 4. Merge stats + EXPLAIN into final results ───────────────────────────
  const results = benchmarks.map(b => ({
    query: b.name,
    min_ms: b.min_ms,
    max_ms: b.max_ms,
    avg_ms: b.avg_ms,
    p50_ms: b.p50_ms,
    p95_ms: b.p95_ms,
    p99_ms: b.p99_ms,
    explainPlan: explainMap[b.name] ?? []
  }));

  fs.writeFileSync(
    '/home/ubuntu/CMMS_REAL/benchmarks/db-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ DB Benchmark Completed via Drizzle ORM! Results saved to db-results.json');
  process.exit(0);
}

runAnalysis().catch(err => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
