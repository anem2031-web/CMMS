import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4QLyZNrgTT18fMs.root:P4U13RrqYbofEO2y@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/cmms?ssl={"rejectUnauthorized":true}';

// Parse mysql:// URL manually
function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace('/', ''),
    ssl: { rejectUnauthorized: true },
  };
}

async function main() {
  const conn = await mysql.createConnection(parseUrl(DB_URL));

  // 1. All tables with exact row counts
  const [tables] = await conn.execute(`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'cmms' ORDER BY TABLE_NAME
  `);
  console.log('\n=== ALL TABLES (exact counts) ===');
  for (const t of tables) {
    const [[row]] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${t.TABLE_NAME}\``);
    console.log(`  ${t.TABLE_NAME}: ${row.cnt}`);
  }

  // 2. FK constraints
  const [fks] = await conn.execute(`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'cmms' AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log('\n=== FK CONSTRAINTS ===');
  for (const fk of fks) {
    console.log(`  ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
  }

  // 3. Orphan checks
  console.log('\n=== ORPHAN CHECKS ===');
  const [[a1]] = await conn.execute(`SELECT COUNT(*) as cnt FROM assets a LEFT JOIN sites s ON a.siteId=s.id WHERE a.siteId IS NOT NULL AND s.id IS NULL`);
  console.log(`  assets.siteId orphans: ${a1.cnt}`);
  const [[a2]] = await conn.execute(`SELECT COUNT(*) as cnt FROM assets a LEFT JOIN sections sc ON a.sectionId=sc.id WHERE a.sectionId IS NOT NULL AND sc.id IS NULL`);
  console.log(`  assets.sectionId orphans: ${a2.cnt}`);
  const [[s1]] = await conn.execute(`SELECT COUNT(*) as cnt FROM sections sc LEFT JOIN sites s ON sc.siteId=s.id WHERE sc.siteId IS NOT NULL AND s.id IS NULL`);
  console.log(`  sections.siteId orphans: ${s1.cnt}`);

  // 4. Current sites
  const [siteRows] = await conn.execute('SELECT id, name FROM sites ORDER BY id');
  console.log('\n=== CURRENT SITES ===');
  for (const s of siteRows) console.log(`  id=${s.id}  "${s.name}"`);

  // 5. Current sections
  const [secRows] = await conn.execute('SELECT id, name, siteId FROM sections ORDER BY id');
  console.log('\n=== CURRENT SECTIONS ===');
  for (const s of secRows) console.log(`  id=${s.id}  siteId=${s.siteId}  "${s.name}"`);

  await conn.end();
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
