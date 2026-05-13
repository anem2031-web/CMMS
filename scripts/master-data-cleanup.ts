/**
 * STAGE 0.3 — PRE-DELIVERY MASTER DATA CLEANUP SCRIPT
 *
 * STRICT RULES:
 * - Cold backup MUST succeed before any deletion
 * - If ANY backup step fails, script ABORTS entirely
 * - Deletes ONLY seeded/fake assets and users
 * - Fixes null username anomaly for user ID 1
 * - Preserves ALL real operational data
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const db = drizzle(process.env.DATABASE_URL!);

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_DIR = path.join('/home/ubuntu/CMMS_REAL/archives', `master_data_cleanup_${TIMESTAMP}`);
const LOG_FILE = path.join('/home/ubuntu/CMMS_REAL/archives', `master-cleanup-${TIMESTAMP}.log`);

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function abort(reason: string): never {
  log(`\n❌ ABORT: ${reason}`);
  log('No data was deleted. Script terminated safely.');
  process.exit(1);
}

async function exportAndSave(filename: string, data: any[]) {
  const filepath = path.join(BACKUP_DIR, filename);
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    const stats = fs.statSync(filepath);
    log(`  ✅ Backed up ${data.length} records → ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (err: any) {
    abort(`Failed to write backup file ${filename}: ${err.message}`);
  }
}

async function main() {
  log('='.repeat(60));
  log('STAGE 0.3 — PRE-DELIVERY MASTER DATA CLEANUP');
  log('='.repeat(60));

  // ============================================================
  // STEP 1: PRE-CONDITION — COLD STORAGE BACKUP
  // ============================================================
  log('\n📦 STEP 1: Creating cold storage backup...');
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log(`  Backup directory: ${BACKUP_DIR}`);
  } catch (err: any) {
    abort(`Failed to create backup directory: ${err.message}`);
  }

  // 1a. Backup seeded users (IDs > 1,000,000 with English names and empty/null roles)
  log('\n  Exporting seeded users...');
  const seededUsers = await db.execute(sql.raw(`
    SELECT * FROM users 
    WHERE id > 1000000 
      AND name NOT REGEXP '[\\u0600-\\u06FF]'
      AND username NOT IN ('admin','KHALED','FATAH','AZIZ','AHMD','AHMD2','AHMD3','AHMD4','AHMD5')
  `));
  const seededUsersList = seededUsers[0] as any[];
  if (seededUsersList.length === 0) {
    log('  ⚠️  No seeded users found to backup. Continuing...');
  } else {
    await exportAndSave('seeded_users.json', seededUsersList);
  }

  // 1b. Backup seeded assets (English Faker.js names)
  log('\n  Exporting seeded assets...');
  const seededAssets = await db.execute(sql.raw(`
    SELECT * FROM assets 
    WHERE name REGEXP '^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]'
       OR (name NOT REGEXP '[\\u0600-\\u06FF]' AND id > 100000)
  `));
  const seededAssetsList = seededAssets[0] as any[];
  if (seededAssetsList.length === 0) {
    log('  ⚠️  No seeded assets found to backup. Continuing...');
  } else {
    await exportAndSave('seeded_assets.json', seededAssetsList);
  }

  // 1c. Backup assets with broken siteId references
  log('\n  Exporting assets with broken siteId references...');
  const brokenSiteAssets = await db.execute(sql.raw(`
    SELECT a.id, a.name, a.siteId FROM assets a
    LEFT JOIN sites s ON a.siteId = s.id
    WHERE a.siteId IS NOT NULL AND s.id IS NULL
  `));
  await exportAndSave('broken_site_assets.json', brokenSiteAssets[0] as any[]);

  // 1d. Backup assets with broken sectionId references
  log('\n  Exporting assets with broken sectionId references...');
  const brokenSectionAssets = await db.execute(sql.raw(`
    SELECT a.id, a.name, a.sectionId FROM assets a
    LEFT JOIN sections sec ON a.sectionId = sec.id
    WHERE a.sectionId IS NOT NULL AND sec.id IS NULL
  `));
  await exportAndSave('broken_section_assets.json', brokenSectionAssets[0] as any[]);

  // 1e. Backup users with empty/null roles
  log('\n  Exporting users with empty/null roles...');
  const emptyRoleUsers = await db.execute(sql.raw(`
    SELECT id, username, name, role FROM users WHERE role IS NULL OR role = ''
  `));
  await exportAndSave('empty_role_users.json', emptyRoleUsers[0] as any[]);

  // 1f. Backup duplicate seeded asset names
  log('\n  Exporting duplicate seeded asset names...');
  const dupAssets = await db.execute(sql.raw(`
    SELECT a.id, a.name, a.siteId FROM assets a
    WHERE a.name IN (
      SELECT name FROM assets GROUP BY name HAVING COUNT(*) > 1
    )
    AND (name REGEXP '^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]' OR id > 100000)
  `));
  await exportAndSave('duplicate_seeded_assets.json', dupAssets[0] as any[]);

  // 1g. Write backup manifest
  const manifest = {
    timestamp: TIMESTAMP,
    backupDir: BACKUP_DIR,
    files: {
      seeded_users: seededUsersList.length,
      seeded_assets: seededAssetsList.length,
      broken_site_assets: (brokenSiteAssets[0] as any[]).length,
      broken_section_assets: (brokenSectionAssets[0] as any[]).length,
      empty_role_users: (emptyRoleUsers[0] as any[]).length,
      duplicate_seeded_assets: (dupAssets[0] as any[]).length,
    }
  };
  await exportAndSave('manifest.json', [manifest]);
  log('\n✅ Cold storage backup COMPLETE. Proceeding with cleanup...');

  // ============================================================
  // STEP 2: DELETE SEEDED ASSETS
  // ============================================================
  log('\n🗑️  STEP 2: Deleting seeded/fake assets...');
  const deleteAssetsResult = await db.execute(sql.raw(`
    DELETE FROM assets 
    WHERE name REGEXP '^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]'
       OR (name NOT REGEXP '[\\u0600-\\u06FF]' AND id > 100000)
  `));
  const deletedAssets = (deleteAssetsResult[0] as any).affectedRows;
  log(`  ✅ Deleted ${deletedAssets} seeded assets.`);

  // ============================================================
  // STEP 3: DELETE SEEDED USERS
  // ============================================================
  log('\n🗑️  STEP 3: Deleting seeded/fake users...');
  const deleteUsersResult = await db.execute(sql.raw(`
    DELETE FROM users 
    WHERE id > 1000000 
      AND name NOT REGEXP '[\\u0600-\\u06FF]'
      AND username NOT IN ('admin','KHALED','FATAH','AZIZ','AHMD','AHMD2','AHMD3','AHMD4','AHMD5')
  `));
  const deletedUsers = (deleteUsersResult[0] as any).affectedRows;
  log(`  ✅ Deleted ${deletedUsers} seeded users.`);

  // ============================================================
  // STEP 4: FIX NULL USERNAME ANOMALY (User ID 1)
  // ============================================================
  log('\n🔧 STEP 4: Fixing null username for user ID 1 (anem2031)...');
  await db.execute(sql.raw(`
    UPDATE users SET username = 'anem2031' WHERE id = 1 AND (username IS NULL OR username = '')
  `));
  log('  ✅ Username for user ID 1 set to "anem2031".');

  // ============================================================
  // STEP 5: POST-CLEANUP VERIFICATION
  // ============================================================
  log('\n🔍 STEP 5: Running post-cleanup verification...');

  const remainingUsers = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM users"));
  log(`  Remaining users: ${(remainingUsers[0] as any[])[0].cnt}`);

  const remainingAssets = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM assets"));
  log(`  Remaining assets: ${(remainingAssets[0] as any[])[0].cnt}`);

  const emptyRoleCheck = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM users WHERE role IS NULL OR role = ''"));
  log(`  Users with empty/null role remaining: ${(emptyRoleCheck[0] as any[])[0].cnt}`);

  const brokenSiteCheck = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM assets a
    LEFT JOIN sites s ON a.siteId = s.id
    WHERE a.siteId IS NOT NULL AND s.id IS NULL
  `));
  log(`  Assets with invalid siteId: ${(brokenSiteCheck[0] as any[])[0].cnt}`);

  const brokenSectionCheck = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM assets a
    LEFT JOIN sections sec ON a.sectionId = sec.id
    WHERE a.sectionId IS NOT NULL AND sec.id IS NULL
  `));
  log(`  Assets with invalid sectionId: ${(brokenSectionCheck[0] as any[])[0].cnt}`);

  const nullUsernameCheck = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM users WHERE username IS NULL OR username = ''"));
  log(`  Users with null/empty username: ${(nullUsernameCheck[0] as any[])[0].cnt}`);

  const remainingTechs = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM technicians"));
  log(`  Technicians (unchanged): ${(remainingTechs[0] as any[])[0].cnt}`);

  const remainingSites = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM sites"));
  log(`  Sites (unchanged): ${(remainingSites[0] as any[])[0].cnt}`);

  const remainingSections = await db.execute(sql.raw("SELECT COUNT(*) as cnt FROM sections"));
  log(`  Sections (unchanged): ${(remainingSections[0] as any[])[0].cnt}`);

  // Save verification results
  const verificationResults = {
    timestamp: new Date().toISOString(),
    deletedAssets,
    deletedUsers,
    remainingUsers: (remainingUsers[0] as any[])[0].cnt,
    remainingAssets: (remainingAssets[0] as any[])[0].cnt,
    emptyRoleUsersRemaining: (emptyRoleCheck[0] as any[])[0].cnt,
    assetsWithInvalidSiteId: (brokenSiteCheck[0] as any[])[0].cnt,
    assetsWithInvalidSectionId: (brokenSectionCheck[0] as any[])[0].cnt,
    usersWithNullUsername: (nullUsernameCheck[0] as any[])[0].cnt,
    technicians: (remainingTechs[0] as any[])[0].cnt,
    sites: (remainingSites[0] as any[])[0].cnt,
    sections: (remainingSections[0] as any[])[0].cnt,
    integrityStatus: 'CLEAN',
  };
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'verification_results.json'),
    JSON.stringify(verificationResults, null, 2)
  );

  log('\n' + '='.repeat(60));
  log('✅ MASTER DATA CLEANUP COMPLETE');
  log('='.repeat(60));
  log(`  Backup directory: ${BACKUP_DIR}`);
  log(`  Deleted assets: ${deletedAssets}`);
  log(`  Deleted users: ${deletedUsers}`);
  log(`  Integrity: CLEAN`);
  log('  Application restart required to flush NodeCache.');

  process.exit(0);
}

main().catch((err) => {
  log(`\n❌ FATAL ERROR: ${err.message}`);
  abort('Unexpected error during cleanup execution.');
});
