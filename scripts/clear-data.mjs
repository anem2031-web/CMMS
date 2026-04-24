/**
 * سكريبت تفريغ قاعدة البيانات - يحذف جميع البيانات مع الإبقاء على المستخدمين
 * يُستخدم مرة واحدة قبل تسليم النظام للعميل
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود في البيئة");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

console.log("🚀 بدء تفريغ قاعدة البيانات...\n");

// ترتيب الحذف مهم بسبب Foreign Keys (من الأطراف إلى المركز)
const tablesToClear = [
  // أولاً: الجداول الفرعية التي تعتمد على جداول أخرى
  "two_factor_audit_logs",
  "two_factor_secrets",
  "push_subscriptions",
  "asset_metrics",
  "pm_jobs",
  "asset_spare_parts",
  "pm_work_orders",
  "preventive_plans",
  "asset_metrics",
  "attachments",
  "ticket_status_history",
  "audit_logs",
  "notifications",
  "inventory_transactions",
  "inventory",
  "purchase_order_items",
  "purchase_orders",
  "tickets",
  "assets",
  "translation_versions",
  "translation_jobs",
  "entity_translations",
  "backups",
  // ثانياً: الجداول الأساسية (مواقع وأقسام وفنيين)
  "technicians",
  "sections",
  "sites",
];

try {
  // تعطيل فحص Foreign Keys مؤقتاً لتسهيل الحذف
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
  console.log("⚙️  تم تعطيل Foreign Key Checks مؤقتاً\n");

  let successCount = 0;
  let skipCount = 0;

  for (const table of tablesToClear) {
    try {
      const [result] = await conn.execute(`DELETE FROM \`${table}\``);
      const affectedRows = result.affectedRows ?? 0;
      console.log(`✅ ${table}: تم حذف ${affectedRows} صف`);
      successCount++;
    } catch (err) {
      if (err.code === "ER_NO_SUCH_TABLE") {
        console.log(`⏭️  ${table}: الجدول غير موجود (تجاهل)`);
        skipCount++;
      } else {
        console.error(`❌ ${table}: خطأ - ${err.message}`);
      }
    }
  }

  // إعادة تفعيل فحص Foreign Keys
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("\n⚙️  تم إعادة تفعيل Foreign Key Checks\n");

  // التحقق من بقاء المستخدمين
  const [usersResult] = await conn.execute("SELECT COUNT(*) as cnt FROM `users`");
  const userCount = usersResult[0].cnt;

  console.log("═══════════════════════════════════════");
  console.log(`✅ تم تفريغ ${successCount} جدول بنجاح`);
  console.log(`⏭️  تم تجاهل ${skipCount} جدول غير موجود`);
  console.log(`👥 المستخدمون المحفوظون: ${userCount} مستخدم`);
  console.log("═══════════════════════════════════════");
  console.log("🎉 قاعدة البيانات جاهزة للعميل!");

} catch (err) {
  console.error("❌ خطأ عام:", err.message);
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
  process.exit(1);
} finally {
  await conn.end();
}
