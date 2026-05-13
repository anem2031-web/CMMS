import { getDb } from "../server/db";
import {
  catalogNodes,
  catalogItems,
  catalogItemSpecs,
  catalogItemNodes,
  catalogItemImages,
  catalogBusiness,
  suppliers,
} from "./schema";

export async function seedCatalogData() {
  console.log("🌱 Starting catalog seed data...");
  const db = await getDb();
  if (!db) {
    throw new Error("Failed to connect to database");
  }

  try {
    // ─── Step 1: Create Suppliers ──────────────────────────────────────────
    const supplierRecords = await db
      .insert(suppliers)
      .values([
        {
          nameAr: "شركة الدهانات الوطنية",
          nameEn: "National Paint Company",
          nameUr: "قومی پینٹ کمپنی",
          contactPerson: "أحمد محمد",
          email: "info@nationalpaints.com",
          phone: "+966501234567",
          address: "الرياض، المملكة العربية السعودية",
          isActive: true,
        },
        {
          nameAr: "شركة الكهرباء المتقدمة",
          nameEn: "Advanced Electrical Company",
          nameUr: "جدید الیکٹریکل کمپنی",
          contactPerson: "محمد علي",
          email: "sales@advancedelectric.com",
          phone: "+966502345678",
          address: "جدة، المملكة العربية السعودية",
          isActive: true,
        },
        {
          nameAr: "شركة السباكة المحترفة",
          nameEn: "Professional Plumbing Company",
          nameUr: "پروفیشنل پلمبنگ کمپنی",
          contactPerson: "فهد الأحمد",
          email: "contact@proplumbing.com",
          phone: "+966503456789",
          address: "الدمام، المملكة العربية السعودية",
          isActive: true,
        },
      ])
      .returning();

    console.log(`✅ Created ${supplierRecords.length} suppliers`);

    // ─── Step 2: Create Taxonomy Nodes (Hierarchical Structure) ────────────
    // Level 1: Main Sections (الأقسام الرئيسية)
    const paintSection = await db
      .insert(catalogNodes)
      .values({
        nameAr: "الدهانات",
        nameEn: "Paints",
        nameUr: "پینٹس",
        descriptionAr: "جميع أنواع الدهانات والمواد الطلائية",
        descriptionEn: "All types of paints and coating materials",
        descriptionUr: "تمام اقسام کے پینٹس اور کوٹنگ مواد",
        level: 1,
        parentId: null,
        isActive: true,
      })
      .returning();

    const electricSection = await db
      .insert(catalogNodes)
      .values({
        nameAr: "الكهرباء",
        nameEn: "Electrical",
        nameUr: "الیکٹریکل",
        descriptionAr: "مواد وأجهزة كهربائية",
        descriptionEn: "Electrical materials and equipment",
        descriptionUr: "الیکٹریکل مواد اور سامان",
        level: 1,
        parentId: null,
        isActive: true,
      })
      .returning();

    const plumbingSection = await db
      .insert(catalogNodes)
      .values({
        nameAr: "السباكة",
        nameEn: "Plumbing",
        nameUr: "پلمبنگ",
        descriptionAr: "أنابيب وتجهيزات سباكة",
        descriptionEn: "Pipes and plumbing fixtures",
        descriptionUr: "پائپس اور پلمبنگ فکسچرز",
        level: 1,
        parentId: null,
        isActive: true,
      })
      .returning();

    console.log(`✅ Created main sections`);

    // Level 2: Categories (التصنيفات)
    const doorPaintCategory = await db
      .insert(catalogNodes)
      .values({
        nameAr: "دهانات الأبواب",
        nameEn: "Door Paints",
        nameUr: "دروازوں کے پینٹس",
        descriptionAr: "دهانات متخصصة للأبواب الخشبية والمعدنية",
        descriptionEn: "Specialized paints for wooden and metal doors",
        descriptionUr: "لکڑی اور دھاتی دروازوں کے لیے خصوصی پینٹس",
        level: 2,
        parentId: paintSection[0].id,
        isActive: true,
      })
      .returning();

    const wallPaintCategory = await db
      .insert(catalogNodes)
      .values({
        nameAr: "دهانات الجدران",
        nameEn: "Wall Paints",
        nameUr: "دیواروں کے پینٹس",
        descriptionAr: "دهانات داخلية وخارجية للجدران",
        descriptionEn: "Interior and exterior wall paints",
        descriptionUr: "اندرونی اور بیرونی دیوار کے پینٹس",
        level: 2,
        parentId: paintSection[0].id,
        isActive: true,
      })
      .returning();

    const switchesCategory = await db
      .insert(catalogNodes)
      .values({
        nameAr: "المفاتيح الكهربائية",
        nameEn: "Electrical Switches",
        nameUr: "الیکٹریکل سوئچز",
        descriptionAr: "مفاتيح كهربائية من أنواع مختلفة",
        descriptionEn: "Electrical switches of various types",
        descriptionUr: "مختلف اقسام کے الیکٹریکل سوئچز",
        level: 2,
        parentId: electricSection[0].id,
        isActive: true,
      })
      .returning();

    const wiresCategory = await db
      .insert(catalogNodes)
      .values({
        nameAr: "الأسلاك الكهربائية",
        nameEn: "Electrical Wires",
        nameUr: "الیکٹریکل تاریں",
        descriptionAr: "أسلاك كهربائية بمقاسات مختلفة",
        descriptionEn: "Electrical wires in various sizes",
        descriptionUr: "مختلف سائز میں الیکٹریکل تاریں",
        level: 2,
        parentId: electricSection[0].id,
        isActive: true,
      })
      .returning();

    const pipesCategory = await db
      .insert(catalogNodes)
      .values({
        nameAr: "الأنابيب",
        nameEn: "Pipes",
        nameUr: "پائپس",
        descriptionAr: "أنابيب PVC و معادن",
        descriptionEn: "PVC and metal pipes",
        descriptionUr: "PVC اور دھاتی پائپس",
        level: 2,
        parentId: plumbingSection[0].id,
        isActive: true,
      })
      .returning();

    console.log(`✅ Created categories`);

    // Level 3: Types/Subcategories (الأنواع)
    const glossPaintType = await db
      .insert(catalogNodes)
      .values({
        nameAr: "دهان لامع (ناري)",
        nameEn: "Gloss Paint",
        nameUr: "چمکدار پینٹ",
        descriptionAr: "دهان بتشطيب لامع عالي",
        descriptionEn: "Paint with high gloss finish",
        descriptionUr: "اعلیٰ چمک والا ختم",
        level: 3,
        parentId: doorPaintCategory[0].id,
        isActive: true,
      })
      .returning();

    const mattPaintType = await db
      .insert(catalogNodes)
      .values({
        nameAr: "دهان مطفي",
        nameEn: "Matte Paint",
        nameUr: "میٹ پینٹ",
        descriptionAr: "دهان بتشطيب مطفي ناعم",
        descriptionEn: "Paint with matte finish",
        descriptionUr: "میٹ ختم والا پینٹ",
        level: 3,
        parentId: doorPaintType[0].id,
        isActive: true,
      })
      .returning();

    const pvcPipeType = await db
      .insert(catalogNodes)
      .values({
        nameAr: "أنابيب PVC",
        nameEn: "PVC Pipes",
        nameUr: "PVC پائپس",
        descriptionAr: "أنابيب PVC بمقاسات مختلفة",
        descriptionEn: "PVC pipes in various sizes",
        descriptionUr: "مختلف سائز میں PVC پائپس",
        level: 3,
        parentId: pipesCategory[0].id,
        isActive: true,
      })
      .returning();

    console.log(`✅ Created types/subcategories`);

    // ─── Step 3: Create Catalog Items ──────────────────────────────────────
    const item1 = await db
      .insert(catalogItems)
      .values({
        codeAr: "DHP-001",
        codeEn: "DHP-001",
        nameAr: "دهان ناري للأبواب - أبيض",
        nameEn: "Gloss Door Paint - White",
        nameUr: "دروازوں کے لیے چمکدار پینٹ - سفید",
        descriptionAr: "دهان عالي الجودة للأبواب الخشبية بلون أبيض ناصع",
        descriptionEn: "High-quality gloss paint for wooden doors in pure white",
        descriptionUr: "لکڑی کے دروازوں کے لیے اعلیٰ معیار کا چمکدار پینٹ سفید رنگ میں",
        unitAr: "لتر",
        unitEn: "Liter",
        unitUr: "لیٹر",
        isActive: true,
      })
      .returning();

    const item2 = await db
      .insert(catalogItems)
      .values({
        codeAr: "DHP-002",
        codeEn: "DHP-002",
        nameAr: "دهان مطفي للأبواب - بني",
        nameEn: "Matte Door Paint - Brown",
        nameUr: "دروازوں کے لیے میٹ پینٹ - براؤن",
        descriptionAr: "دهان مطفي للأبواب بلون بني دافئ",
        descriptionEn: "Matte paint for doors in warm brown color",
        descriptionUr: "دروازوں کے لیے میٹ پینٹ گرم براؤن رنگ میں",
        unitAr: "لتر",
        unitEn: "Liter",
        unitUr: "لیٹر",
        isActive: true,
      })
      .returning();

    const item3 = await db
      .insert(catalogItems)
      .values({
        codeAr: "PVC-001",
        codeEn: "PVC-001",
        nameAr: "أنبوب PVC - 2 بوصة",
        nameEn: "PVC Pipe - 2 Inch",
        nameUr: "PVC پائپ - 2 انچ",
        descriptionAr: "أنبوب PVC قطر 2 بوصة للتطبيقات السباكية",
        descriptionEn: "PVC pipe 2 inch diameter for plumbing applications",
        descriptionUr: "پلمبنگ کی درخواستوں کے لیے 2 انچ قطر والی PVC پائپ",
        unitAr: "متر",
        unitEn: "Meter",
        unitUr: "میٹر",
        isActive: true,
      })
      .returning();

    console.log(`✅ Created catalog items`);

    // ─── Step 4: Link Items to Taxonomy Nodes ──────────────────────────────
    await db.insert(catalogItemNodes).values([
      { itemId: item1[0].id, nodeId: glossPaintType[0].id },
      { itemId: item2[0].id, nodeId: mattPaintType[0].id },
      { itemId: item3[0].id, nodeId: pvcPipeType[0].id },
    ]);

    console.log(`✅ Linked items to taxonomy nodes`);

    // ─── Step 5: Add Item Specifications ───────────────────────────────────
    await db.insert(catalogItemSpecs).values([
      {
        itemId: item1[0].id,
        specKeyAr: "اللون",
        specKeyEn: "Color",
        specKeyUr: "رنگ",
        specValueAr: "أبيض",
        specValueEn: "White",
        specValueUr: "سفید",
      },
      {
        itemId: item1[0].id,
        specKeyAr: "نوع التشطيب",
        specKeyEn: "Finish Type",
        specKeyUr: "ختم کی قسم",
        specValueAr: "لامع",
        specValueEn: "Gloss",
        specValueUr: "چمکدار",
      },
      {
        itemId: item2[0].id,
        specKeyAr: "اللون",
        specKeyEn: "Color",
        specKeyUr: "رنگ",
        specValueAr: "بني",
        specValueEn: "Brown",
        specValueUr: "براؤن",
      },
      {
        itemId: item3[0].id,
        specKeyAr: "القطر",
        specKeyEn: "Diameter",
        specKeyUr: "قطر",
        specValueAr: "2 بوصة",
        specValueEn: "2 Inch",
        specValueUr: "2 انچ",
      },
    ]);

    console.log(`✅ Added item specifications`);

    // ─── Step 6: Add Business Data (Suppliers & Pricing) ────────────────────
    await db.insert(catalogBusiness).values([
      {
        itemId: item1[0].id,
        supplierId: supplierRecords[0].id,
        priceAED: 45.99,
        priceUSD: 12.5,
        minOrderQuantity: 1,
        leadTimeDays: 3,
        isPreferred: true,
      },
      {
        itemId: item2[0].id,
        supplierId: supplierRecords[0].id,
        priceAED: 48.99,
        priceUSD: 13.33,
        minOrderQuantity: 1,
        leadTimeDays: 3,
        isPreferred: true,
      },
      {
        itemId: item3[0].id,
        supplierId: supplierRecords[2].id,
        priceAED: 25.5,
        priceUSD: 6.96,
        minOrderQuantity: 10,
        leadTimeDays: 5,
        isPreferred: true,
      },
    ]);

    console.log(`✅ Added business data (suppliers & pricing)`);

    console.log("🎉 Catalog seed data completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding catalog data:", error);
    throw error;
  }
}
