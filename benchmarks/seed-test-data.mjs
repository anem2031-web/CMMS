import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://4QLyZNrgTT18fMs.root:P4U13RrqYbofEO2y@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/cmms';

async function seed() {
  console.log('🚀 Starting Seeding Process...');
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: true }
  });

  // Get current state
  const [userRows] = await connection.execute('SELECT id FROM users');
  const userIds = userRows.map(r => r.id);
  const [siteRows] = await connection.execute('SELECT id FROM sites');
  const siteIds = siteRows.map(r => r.id);
  const [sectionRows] = await connection.execute('SELECT id FROM sections');
  const sectionIds = sectionRows.map(r => r.id);

  // 1. Create 50 Users
  console.log('👥 Seeding 50 users...');
  const roles = ['user', 'admin', 'technician', 'supervisor', 'manager', 'owner'];
  for (let i = 0; i < 50; i++) {
    await connection.execute(
      'INSERT IGNORE INTO users (openId, username, passwordHash, name, role, loginMethod, preferredLanguage, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nanoid(), faker.internet.username(), 'mock_hash', faker.person.fullName(), faker.helpers.arrayElement(roles), 'credentials', 'ar', 1]
    );
  }
  const [allUserRows] = await connection.execute('SELECT id FROM users');
  const allUserIds = allUserRows.map(r => r.id);

  // 2. Create 500 Assets
  console.log('📦 Seeding 500 assets...');
  for (let i = 0; i < 500; i++) {
    await connection.execute(
      'INSERT IGNORE INTO assets (assetNumber, name, category, siteId, sectionId, status) VALUES (?, ?, ?, ?, ?, ?)',
      [`AST-${faker.string.numeric(5)}`, faker.commerce.productName(), 'general', faker.helpers.arrayElement(siteIds), faker.helpers.arrayElement(sectionIds), 'active']
    );
  }
  const [assetRows] = await connection.execute('SELECT id FROM assets');
  const assetIds = assetRows.map(r => r.id);

  // 3. Create 10,000 Tickets
  console.log('🎫 Seeding 10,000 tickets...');
  const ticketStatuses = ['new', 'pending_triage', 'under_inspection', 'work_approved', 'approved', 'assigned', 'in_progress', 'closed'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const categories = ['electrical', 'plumbing', 'hvac', 'structural', 'mechanical', 'general', 'safety', 'cleaning'];
  
  for (let i = 0; i < 100; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      batch.push([
        `TKT-${faker.string.numeric(6)}-${i}-${j}`,
        faker.lorem.sentence().substring(0, 300),
        faker.lorem.paragraph(),
        faker.helpers.arrayElement(ticketStatuses),
        faker.helpers.arrayElement(priorities),
        faker.helpers.arrayElement(categories),
        faker.helpers.arrayElement(allUserIds),
        faker.helpers.arrayElement(allUserIds),
        faker.helpers.arrayElement(assetIds),
        new Date(),
        new Date()
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO tickets (ticketNumber, title, description, status, priority, category, reportedById, assignedToId, assetId, createdAt, updatedAt) VALUES ${placeholders}`,
      batch.flat()
    );
  }
  const [allTicketRows] = await connection.execute('SELECT id FROM tickets LIMIT 10000');
  const allTicketIds = allTicketRows.map(r => r.id);

  // 4. Create 15,000 ticket_status_history
  console.log('📜 Seeding 15,000 status history records...');
  for (let i = 0; i < 150; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      batch.push([
        faker.helpers.arrayElement(allTicketIds),
        faker.helpers.arrayElement(ticketStatuses),
        faker.helpers.arrayElement(allUserIds),
        new Date()
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO ticket_status_history (ticketId, toStatus, changedById, createdAt) VALUES ${placeholders}`,
      batch.flat()
    );
  }

  // 5. Create 2,000 Purchase Orders
  console.log('💰 Seeding 2,000 purchase orders...');
  const poStatuses = ['draft', 'pending_review', 'pending_estimate', 'pending_accounting', 'pending_management', 'approved', 'partial_purchase', 'purchased', 'received', 'closed', 'rejected', 'revision_needed'];
  for (let i = 0; i < 20; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      batch.push([
        `PO-${faker.string.numeric(6)}-${i}-${j}`,
        faker.helpers.arrayElement(poStatuses),
        faker.helpers.arrayElement(allUserIds),
        faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
        new Date()
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO purchase_orders (poNumber, status, requestedById, totalEstimatedCost, createdAt) VALUES ${placeholders}`,
      batch.flat()
    );
  }
  const [poRows] = await connection.execute('SELECT id FROM purchase_orders LIMIT 2000');
  const poIds = poRows.map(r => r.id);

  // 6. Create 5,000 Purchase Order Items
  console.log('🛒 Seeding 5,000 PO items...');
  for (let i = 0; i < 50; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      const qty = faker.number.int({ min: 1, max: 50 });
      const price = faker.number.float({ min: 10, max: 500, fractionDigits: 2 });
      batch.push([
        faker.helpers.arrayElement(poIds),
        faker.commerce.productName().substring(0, 300),
        qty,
        price,
        qty * price
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO purchase_order_items (purchaseOrderId, itemName, quantity, estimatedUnitCost, estimatedTotalCost) VALUES ${placeholders}`,
      batch.flat()
    );
  }

  // 7. Create 20,000 Notifications
  console.log('🔔 Seeding 20,000 notifications...');
  for (let i = 0; i < 200; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      batch.push([
        faker.helpers.arrayElement(allUserIds),
        'system',
        faker.lorem.sentence().substring(0, 500),
        faker.datatype.boolean() ? 1 : 0,
        new Date()
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO notifications (userId, type, message, isRead, createdAt) VALUES ${placeholders}`,
      batch.flat()
    );
  }

  // 8. Create 30,000 Audit Logs
  console.log('📑 Seeding 30,000 audit logs...');
  for (let i = 0; i < 300; i++) {
    const batch = [];
    for (let j = 0; j < 100; j++) {
      batch.push([
        faker.helpers.arrayElement(allUserIds),
        faker.helpers.arrayElement(['create', 'update', 'delete', 'login']),
        faker.helpers.arrayElement(['tickets', 'assets', 'purchase_orders', 'users']),
        faker.string.uuid(),
        JSON.stringify({ action: 'audit', timestamp: new Date() }),
        new Date()
      ]);
    }
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
    await connection.execute(
      `INSERT IGNORE INTO audit_logs (userId, action, entityType, entityId, details, createdAt) VALUES ${placeholders}`,
      batch.flat()
    );
  }

  console.log('✅ Seeding Completed Successfully!');
  await connection.end();
}

seed().catch(err => {
  console.error('❌ Seeding Failed:', err);
  process.exit(1);
});
