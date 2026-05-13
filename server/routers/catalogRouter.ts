import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { eq, and, like, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  catalogNodes,
  catalogItems,
  catalogItemSpecs,
  catalogItemNodes,
  catalogItemImages,
  catalogBusiness,
  catalogSettings,
  catalogAuditLogs,
  type InsertCatalogNode,
  type InsertCatalogItem,
  type InsertCatalogItemSpec,
  type InsertCatalogBusiness,
  type InsertCatalogAuditLog,
} from "../../drizzle/schema";

// ============================================================
// TAXONOMY LAYER - Hierarchical Classification
// ============================================================

export const catalogRouter = router({
  // ────────────────────────────────────────────────────────
  // TAXONOMY NODES - CRUD Operations
  // ────────────────────────────────────────────────────────

  /**
   * Get all taxonomy nodes (with optional filtering)
   */
  nodes: router({
    list: publicProcedure
      .input(
        z.object({
          parentId: z.number().optional(),
          isActive: z.boolean().optional(),
          level: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const conditions = [];

        if (input?.parentId !== undefined) {
          conditions.push(eq(catalogNodes.parentId, input.parentId));
        }
        if (input?.isActive !== undefined) {
          conditions.push(eq(catalogNodes.isActive, input.isActive));
        }
        if (input?.level !== undefined) {
          conditions.push(eq(catalogNodes.level, input.level));
        }

        const query = db.select().from(catalogNodes);
        if (conditions.length > 0) {
          return await query.where(and(...conditions));
        }
        return await query;
      }),

    /**
     * Get a single node by ID
     */
    getById: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const result = await db
          .select()
          .from(catalogNodes)
          .where(eq(catalogNodes.id, input))
          .limit(1);
        return result[0] || null;
      }),

    /**
     * Get all children of a node (one level deep)
     */
    getChildren: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        return await db
          .select()
          .from(catalogNodes)
          .where(eq(catalogNodes.parentId, input));
      }),

    /**
     * Create a new taxonomy node
     */
    create: protectedProcedure
      .input(
        z.object({
          nameAr: z.string(),
          nameEn: z.string(),
          nameUr: z.string().optional(),
          descriptionAr: z.string().optional(),
          descriptionEn: z.string().optional(),
          descriptionUr: z.string().optional(),
          parentId: z.number().optional(),
          level: z.number(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const result = await db.insert(catalogNodes).values({
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          nameUr: input.nameUr || null,
          descriptionAr: input.descriptionAr || null,
          descriptionEn: input.descriptionEn || null,
          descriptionUr: input.descriptionUr || null,
          parentId: input.parentId || null,
          level: input.level,
          sortOrder: input.sortOrder || 0,
          isActive: true,
        } as any);

        const insertId = (result as any)[0]?.insertId || 0;

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "create",
            entityType: "node",
            entityId: insertId,
            newValues: JSON.stringify(input),
          } as any);
        }

        return insertId;
      }),

    /**
     * Update a taxonomy node
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          nameAr: z.string().optional(),
          nameEn: z.string().optional(),
          nameUr: z.string().optional(),
          descriptionAr: z.string().optional(),
          descriptionEn: z.string().optional(),
          descriptionUr: z.string().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const { id, ...updateData } = input;

        await db.update(catalogNodes).set(updateData).where(eq(catalogNodes.id, id));

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "update",
            entityType: "node",
            entityId: id,
            newValues: JSON.stringify(updateData),
          } as any);
        }
      }),

    /**
     * Delete a taxonomy node (soft delete)
     */
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        await db.update(catalogNodes).set({ isActive: false }).where(eq(catalogNodes.id, input));

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "delete",
            entityType: "node",
            entityId: input,
          } as any);
        }
      }),
  }),

  // ────────────────────────────────────────────────────────
  // CATALOG ITEMS - CRUD Operations
  // ────────────────────────────────────────────────────────

  items: router({
    /**
     * List all catalog items with search and filtering
     */
    list: publicProcedure
      .input(
        z.object({
          search: z.string().optional(),
          nodeId: z.number().optional(),
          isActive: z.boolean().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        }).optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const conditions = [];

        if (input?.isActive !== undefined) {
          conditions.push(eq(catalogItems.isActive, input.isActive));
        }

        if (input?.search) {
          conditions.push(
            like(catalogItems.nameAr, `%${input.search}%`)
          );
        }

        let query = db.select().from(catalogItems);
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }

        return await (query as any).limit(input?.limit || 50).offset(input?.offset || 0);
      }),

    /**
     * Get a single item with all its details
     */
    getById: publicProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const item = await db
          .select()
          .from(catalogItems)
          .where(eq(catalogItems.id, input))
          .limit(1);

        if (!item[0]) return null;

        // Get specs
        const specs = await db
          .select()
          .from(catalogItemSpecs)
          .where(eq(catalogItemSpecs.itemId, input));

        // Get images
        const images = await db
          .select()
          .from(catalogItemImages)
          .where(eq(catalogItemImages.itemId, input));

        return {
          ...item[0],
          specs,
          images,
        };
      }),

    /**
     * Create a new catalog item
     */
    create: protectedProcedure
      .input(
        z.object({
          nameAr: z.string(),
          nameEn: z.string(),
          nameUr: z.string().optional(),
          descriptionAr: z.string().optional(),
          descriptionEn: z.string().optional(),
          descriptionUr: z.string().optional(),
          code: z.string().optional(),
          nodeId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const result = await db.insert(catalogItems).values({
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          nameUr: input.nameUr || null,
          descriptionAr: input.descriptionAr || null,
          descriptionEn: input.descriptionEn || null,
          descriptionUr: input.descriptionUr || null,
          code: input.code || null,
          nodeId: input.nodeId,
          isActive: true,
        } as any);

        const insertId = (result as any)[0]?.insertId || 0;

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "create",
            entityType: "item",
            entityId: insertId,
            newValues: JSON.stringify(input),
          } as any);
        }

        return insertId;
      }),

    /**
     * Update a catalog item
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          nameAr: z.string().optional(),
          nameEn: z.string().optional(),
          nameUr: z.string().optional(),
          descriptionAr: z.string().optional(),
          descriptionEn: z.string().optional(),
          descriptionUr: z.string().optional(),
          code: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const { id, ...updateData } = input;

        await db.update(catalogItems).set(updateData).where(eq(catalogItems.id, id));

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "update",
            entityType: "item",
            entityId: id,
            newValues: JSON.stringify(updateData),
          } as any);
        }
      }),

    /**
     * Delete a catalog item (soft delete)
     */
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        await db.update(catalogItems).set({ isActive: false }).where(eq(catalogItems.id, input));

        // Log the action
        if (ctx.user?.id) {
          await db.insert(catalogAuditLogs).values({
            userId: ctx.user.id,
            action: "delete",
            entityType: "item",
            entityId: input,
          } as any);
        }
      }),
  }),

  // ────────────────────────────────────────────────────────
  // CATALOG SETTINGS
  // ────────────────────────────────────────────────────────

  settings: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return await db.select().from(catalogSettings);
    }),

    get: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const result = await db
          .select()
          .from(catalogSettings)
          .where(eq(catalogSettings.settingKey, input))
          .limit(1);

        return result[0] || null;
      }),
  }),
});
