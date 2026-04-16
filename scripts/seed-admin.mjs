/**
 * Seed script: creates the default admin user (owner role)
 * username: admin
 * password: ADMIN2025
 *
 * Run with: node scripts/seed-admin.mjs
 */
import { createConnection } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

try {
  // Check if admin already exists
  const [rows] = await conn.execute(
    "SELECT id, username, role FROM users WHERE username = ?",
    ["admin"]
  );

  if (rows.length > 0) {
    console.log("⚠️  Admin user already exists:", rows[0]);
    // Update password and role to ensure it's correct
    const hash = await bcrypt.hash("ADMIN2025", 10);
    await conn.execute(
      "UPDATE users SET passwordHash = ?, role = ?, name = ?, isActive = 1 WHERE username = ?",
      [hash, "owner", "المدير العام", "admin"]
    );
    console.log("✅ Admin password and role updated successfully");
  } else {
    const hash = await bcrypt.hash("ADMIN2025", 10);
    const openId = `local_admin_${randomUUID()}`;
    await conn.execute(
      `INSERT INTO users (openId, username, passwordHash, name, role, isActive, loginMethod, lastSignedIn, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, 'local', NOW(), NOW(), NOW())`,
      [openId, "admin", hash, "المدير العام", "owner"]
    );
    console.log("✅ Admin user created successfully");
    console.log("   Username: admin");
    console.log("   Password: ADMIN2025");
    console.log("   Role: owner");
  }
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
