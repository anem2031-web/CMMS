import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  inventory,
  inventoryCountItems,
  inventoryCountOperations,
  inventoryCountSnapshots,
  inventorySettlements,
  inventorySettlementItems,
  inventorySettlementDrafts,
  inventorySettlementDraftEvents,
  inventoryCountCorrections,
  inventoryLots,
  warehouses,
  users,
} from "../../../drizzle/schema";
import {
  assertSettlementReviewQuantity,
  canPrepareSettlementDraft,
  canReadSettlementDraft,
  canReviewSettlementDraft,
  settlementDraftEditable,
  type SettlementReviewActor,
} from "../../../shared/inventory-settlement-review";

type Actor = SettlementReviewActor;
type VersionInput = { draftId: number; expectedVersion: number };
type SaveInput = {
  draftId?: number;
  expectedVersion?: number;
  sourceCountOperationId: number;
  reason: string;
  reference?: string;
  correctsSettlementId?: number;
};
type PostingParams = {
  sourceType: "from_count";
  sourceCountOperationId: number;
  reason: string;
  reference?: string;
  appliedById: number;
  items: Array<{
    inventoryId: number;
    lotId?: number;
    afterQuantity: number;
    lotNumber?: string;
    expiryDate?: string;
  }>;
};
type Dependencies = {
  getDb: () => Promise<any>;
  applySettlementWithWriter: (
    params: PostingParams,
    tx: any,
    draftId: number
  ) => Promise<any>;
};

const fail = (
  message: string,
  code: "BAD_REQUEST" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" = "BAD_REQUEST"
): never => {
  throw new TRPCError({ code, message });
};
const jsonValue = (value: any) =>
  typeof value === "string" ? JSON.parse(value) : value;
const quantity = (value: unknown) => Number(Number(value ?? 0).toFixed(3));
const reviewedQuantity = (value: number) => {
  try {
    return assertSettlementReviewQuantity(value);
  } catch {
    return fail("الكمية يجب أن تكون غير سالبة وبحد أقصى ثلاث منازل عشرية");
  }
};
const reasonText = (value: string) => {
  const text = value?.trim();
  if (!text || text.length < 10 || text.length > 5000)
    fail("سبب الإجراء إلزامي من 10 إلى 5000 حرف");
  return text;
};
const privileged = (actor: Actor) =>
  actor.role === "owner" || actor.role === "admin";
const assertActor = (actor: Actor, mode: "read" | "prepare" | "review") => {
  const allowed =
    mode === "read"
      ? canReadSettlementDraft(actor.role)
      : mode === "prepare"
        ? canPrepareSettlementDraft(actor.role)
        : canReviewSettlementDraft(actor.role);
  if (!Number.isSafeInteger(actor.id) || actor.id <= 0 || !allowed)
    fail("لا تملك صلاحية هذا الإجراء", "FORBIDDEN");
};

/** The factory deliberately imports no database client/configuration: all writes use the supplied transaction. */
export function createInventorySettlementReviewService(deps: Dependencies) {
  const database = async () => {
    const db = await deps.getDb();
    if (!db) fail("تعذر الاتصال بقاعدة البيانات");
    return db;
  };
  const noPostedSettlement = async (tx: any, operationId: number) => {
    const rows = await tx
      .select({ id: inventorySettlements.id })
      .from(inventorySettlements)
      .where(
        and(
          eq(inventorySettlements.sourceCountOperationId, operationId),
          eq(inventorySettlements.status, "applied")
        )
      )
      .limit(1)
      .for("update");
    if (rows.length)
      fail(
        "تم تطبيق تسوية لهذا الجرد؛ يلزم جرد جديد وتسوية تصحيحية مرتبطة بالمستند السابق",
        "CONFLICT"
      );
  };
  const pendingCorrection = async (tx: any, draftId: number) => {
    const rows = await tx
      .select()
      .from(inventoryCountCorrections)
      .where(
        and(
          eq(inventoryCountCorrections.draftId, draftId),
          eq(inventoryCountCorrections.status, "pending")
        )
      )
      .limit(2)
      .for("update");
    if (rows.length > 1)
      fail("يوجد أكثر من طلب تصحيح مفتوح؛ راجع البيانات", "CONFLICT");
    return rows[0] || null;
  };
  const lockCount = async (tx: any, operationId: number) => {
    await tx.execute(
      sql`SELECT id FROM inventory_count_operations WHERE id = ${operationId} FOR UPDATE`
    );
    const rows = await tx
      .select()
      .from(inventoryCountOperations)
      .where(eq(inventoryCountOperations.id, operationId))
      .limit(1)
      .for("update");
    if (!rows[0]) fail("عملية الجرد المصدر غير موجودة", "NOT_FOUND");
    if (rows[0].status !== "completed")
      fail("يجب حفظ الجرد نهائيًا قبل إعداد التسوية");
    return rows[0];
  };
  const source = async (
    tx: any,
    operationId: number,
    currentOpeningCosts?: Map<number, number>
  ) => {
    const operationQuery = tx
      .select({
        operation: inventoryCountOperations,
        warehouseName: warehouses.nameAr,
      })
      .from(inventoryCountOperations)
      .leftJoin(
        warehouses,
        eq(warehouses.id, inventoryCountOperations.warehouseId)
      )
      .where(eq(inventoryCountOperations.id, operationId))
      .limit(1);
    const operations = await operationQuery;
    const operation = operations[0]
      ? {
          ...operations[0].operation,
          warehouseName: operations[0].warehouseName || null,
        }
      : null;
    if (!operation) fail("عملية الجرد غير موجودة", "NOT_FOUND");
    const itemQuery = tx
      .select({
        countItemId: inventoryCountItems.id,
        inventoryId: inventoryCountItems.inventoryId,
        lotId: inventoryCountItems.lotId,
        lotNumber: inventoryCountItems.lotNumber,
        expiryDate: inventoryCountItems.expiryDate,
        notes: inventoryCountItems.notes,
        countedById: inventoryCountItems.countedById,
        countedAt: inventoryCountItems.countedAt,
        systemQuantity: inventoryCountItems.systemQuantity,
        countedQuantity: inventoryCountItems.countedQuantity,
        diffQuantity: inventoryCountItems.diffQuantity,
        itemName: inventory.itemName,
        unit: inventory.issueUnit,
        fallbackUnit: inventory.unit,
        openingAverageCost: inventory.averageCost,
        lotCode: inventoryLots.lotCode,
        warehouseId: inventory.warehouseId,
      })
      .from(inventoryCountItems)
      .leftJoin(inventory, eq(inventory.id, inventoryCountItems.inventoryId))
      .leftJoin(inventoryLots, eq(inventoryLots.id, inventoryCountItems.lotId))
      .where(eq(inventoryCountItems.operationId, operationId))
      .orderBy(asc(inventoryCountItems.id));
    const rows = await itemQuery;
    if (rows.length > 20_000) fail("حجم الجرد يتجاوز حد مراجعة التسوية الآمن");
    const snapshots = await tx
      .select()
      .from(inventoryCountSnapshots)
      .where(eq(inventoryCountSnapshots.operationId, operationId));
    const snapshotMap = new Map<string, any>();
    for (const row of snapshots) {
      const key = `${row.inventoryId}:${row.lotId ?? 0}`;
      if (snapshotMap.has(key))
        fail("Snapshot الجرد غير فريد؛ راجع البيانات", "CONFLICT");
      snapshotMap.set(key, row);
    }
    const items = rows.map((row: any) => {
      // Opening balance already uses current Inventory cost in the established writer.
      // Include that exact basis in review/fingerprint; periodic counts keep opening snapshots.
      const cost =
        operation.countType === "opening_balance"
          ? (currentOpeningCosts?.get(Number(row.inventoryId)) ??
            Number(row.openingAverageCost || 0))
          : snapshotMap.get(`${row.inventoryId}:${row.lotId ?? 0}`)
              ?.averageCostSnapshot;
      const counted =
        row.countedQuantity == null ? null : quantity(row.countedQuantity);
      const diff = quantity(row.diffQuantity);
      return {
        ...row,
        unit: row.unit || row.fallbackUnit || "",
        systemQuantity: quantity(row.systemQuantity),
        countedQuantity: counted,
        diffQuantity: diff,
        averageCostSnapshot: cost == null ? null : Number(cost),
        diffValue:
          cost == null ? null : Number((diff * Number(cost)).toFixed(2)),
      };
    });
    // Only frozen count facts participate. Renaming an item must not invalidate a financial review.
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          operation: {
            id: operation.id,
            status: operation.status,
            countType: operation.countType,
            warehouseId: operation.warehouseId,
            completedAt: operation.completedAt,
            catalogNodeId: operation.catalogNodeId,
          },
          items: items.map((row: any) => ({
            id: row.countItemId,
            inventoryId: row.inventoryId,
            lotId: row.lotId,
            systemQuantity: row.systemQuantity,
            countedQuantity: row.countedQuantity,
            diffQuantity: row.diffQuantity,
            lotNumber: row.lotNumber,
            expiryDate: row.expiryDate,
            notes: row.notes,
            countedById: row.countedById,
            countedAt: row.countedAt,
            ...(operation.countType === "opening_balance"
              ? { openingUnitCost: row.averageCostSnapshot }
              : {}),
          })),
          snapshots: snapshots
            .map((row: any) => ({
              inventoryId: row.inventoryId,
              lotId: row.lotId,
              systemQuantity: String(row.systemQuantity),
              averageCostSnapshot: String(row.averageCostSnapshot),
              expiryDate: row.expiryDate,
            }))
            .sort(
              (a: any, b: any) =>
                a.inventoryId - b.inventoryId || (a.lotId || 0) - (b.lotId || 0)
            ),
        })
      )
      .digest("hex");
    return {
      sourceCount: operation,
      items,
      fingerprint,
      snapshot: { sourceCount: operation, items },
    };
  };
  const assertSource = (data: Awaited<ReturnType<typeof source>>) => {
    if (data.sourceCount.status !== "completed")
      fail("الجرد المصدر لم يُحفظ نهائيًا");
    if (!data.items.length) fail("لا يمكن إعداد تسوية لجرد فارغ");
    const keys = new Set<string>();
    for (const row of data.items) {
      if (row.countedQuantity == null)
        fail("الجرد يحتوي أصنافًا لم تسجل كمياتها");
      reviewedQuantity(row.countedQuantity);
      if (
        !Number.isFinite(row.systemQuantity) ||
        row.systemQuantity < 0 ||
        !Number.isFinite(row.diffQuantity) ||
        (row.averageCostSnapshot != null &&
          (!Number.isFinite(row.averageCostSnapshot) ||
            row.averageCostSnapshot < 0))
      )
        fail("بيانات كمية أو تكلفة الجرد غير صالحة؛ راجع المصدر", "CONFLICT");
      if (
        data.sourceCount.countType === "periodic" &&
        row.diffQuantity !== 0 &&
        row.averageCostSnapshot == null
      ) {
        fail(
          "لا يمكن إعداد تسوية لهذا الجرد: لقطة تكلفة افتتاح الجرد مفقودة لأحد الفروقات؛ لا تُخمّن التكلفة التاريخية",
          "CONFLICT"
        );
      }
      if (
        !row.itemName ||
        Number(row.warehouseId || 0) !==
          Number(data.sourceCount.warehouseId || 0)
      )
        fail("سطر الجرد لا يطابق مخزن عملية الجرد", "CONFLICT");
      const key = `${row.inventoryId}:${row.lotId ?? 0}`;
      if (keys.has(key))
        fail("يوجد سطر مكرر للصنف والدفعة في الجرد", "CONFLICT");
      keys.add(key);
      if (
        quantity(row.countedQuantity - row.systemQuantity) !== row.diffQuantity
      )
        fail("فرق الجرد لا يطابق الكمية المعدودة", "CONFLICT");
    }
  };
  const ownership = (actor: Actor, draft: any) => {
    if (!privileged(actor) && draft.preparedById !== actor.id)
      fail("تعديل التسوية متاح لمعدّها فقط", "FORBIDDEN");
  };
  const version = (draft: any, expected: number | undefined) => {
    if (!Number.isInteger(expected) || expected !== draft.version)
      fail("تغيرت التسوية؛ حدّث الصفحة ثم أعد المحاولة", "CONFLICT");
  };
  const event = async (
    tx: any,
    draftId: number,
    nextVersion: number,
    action: string,
    actor: Actor,
    reason: string | null,
    payload: any
  ) => {
    await tx.insert(inventorySettlementDraftEvents).values({
      draftId,
      version: nextVersion,
      action,
      actorId: actor.id,
      reason,
      payload,
    });
  };
  const withDraft = async <T>(
    draftId: number,
    work: (tx: any, draft: any) => Promise<T>
  ) => {
    const db = await database();
    // Do not establish an MVCC snapshot before waiting for the count lock.
    const peek = await db
      .select({
        sourceCountOperationId:
          inventorySettlementDrafts.sourceCountOperationId,
      })
      .from(inventorySettlementDrafts)
      .where(eq(inventorySettlementDrafts.id, draftId))
      .limit(1);
    if (!peek[0]) fail("مسودة التسوية غير موجودة", "NOT_FOUND");
    return db.transaction(async (tx: any) => {
      // Every review mutation locks in the same order as the existing posting writer.
      await lockCount(tx, Number(peek[0].sourceCountOperationId));
      await tx.execute(
        sql`SELECT id FROM inventory_settlement_drafts WHERE id = ${draftId} FOR UPDATE`
      );
      const rows = await tx
        .select()
        .from(inventorySettlementDrafts)
        .where(eq(inventorySettlementDrafts.id, draftId))
        .limit(1)
        .for("update");
      if (
        !rows[0] ||
        rows[0].sourceCountOperationId !== peek[0].sourceCountOperationId
      )
        fail("تغير مصدر التسوية", "CONFLICT");
      return work(tx, rows[0]);
    });
  };
  const checkCorrects = async (
    tx: any,
    data: Awaited<ReturnType<typeof source>>,
    settlementId?: number
  ) => {
    if (!settlementId) return;
    const rows = await tx
      .select()
      .from(inventorySettlements)
      .where(eq(inventorySettlements.id, settlementId))
      .limit(1);
    const previous = rows[0];
    if (!previous || previous.status !== "applied")
      fail("التسوية السابقة غير موجودة أو غير مطبقة");
    if (previous.sourceCountOperationId === data.sourceCount.id)
      fail("التسوية التصحيحية تحتاج جردًا جديدًا مستقلًا");
    const previousItems = await tx
      .select({
        inventoryId: inventorySettlementItems.inventoryId,
        lotId: inventorySettlementItems.lotId,
        warehouseId: inventory.warehouseId,
      })
      .from(inventorySettlementItems)
      .innerJoin(
        inventory,
        eq(inventory.id, inventorySettlementItems.inventoryId)
      )
      .where(eq(inventorySettlementItems.settlementId, settlementId));
    const keys = new Set(
      previousItems.map((row: any) => `${row.inventoryId}:${row.lotId ?? 0}`)
    );
    if (
      !previousItems.length ||
      previousItems.some(
        (row: any) =>
          Number(row.warehouseId || 0) !==
          Number(data.sourceCount.warehouseId || 0)
      ) ||
      !data.items.some((row: any) =>
        keys.has(`${row.inventoryId}:${row.lotId ?? 0}`)
      ) ||
      data.items
        .filter((row: any) => row.diffQuantity !== 0)
        .some((row: any) => !keys.has(`${row.inventoryId}:${row.lotId ?? 0}`))
    ) {
      fail(
        "الجرد التصحيحي يجب أن يخص أصناف ودفعات التسوية السابقة في المستودع نفسه"
      );
    }
  };

  return {
    async list(actor: Actor) {
      assertActor(actor, "read");
      const db = await database();
      return db
        .select({
          id: inventorySettlementDrafts.id,
          status: inventorySettlementDrafts.status,
          version: inventorySettlementDrafts.version,
          sourceCountOperationId:
            inventorySettlementDrafts.sourceCountOperationId,
          sourceCountNumber: inventoryCountOperations.operationNumber,
          warehouseName: warehouses.nameAr,
          preparedById: inventorySettlementDrafts.preparedById,
          preparedByName: users.name,
          reason: inventorySettlementDrafts.reason,
          reference: inventorySettlementDrafts.reference,
          lastSubmittedById: inventorySettlementDrafts.lastSubmittedById,
          returnedReason: inventorySettlementDrafts.returnedReason,
          appliedSettlementId: inventorySettlementDrafts.appliedSettlementId,
          correctsSettlementId: inventorySettlementDrafts.correctsSettlementId,
          updatedAt: inventorySettlementDrafts.updatedAt,
          createdAt: inventorySettlementDrafts.createdAt,
        })
        .from(inventorySettlementDrafts)
        .innerJoin(
          inventoryCountOperations,
          eq(
            inventoryCountOperations.id,
            inventorySettlementDrafts.sourceCountOperationId
          )
        )
        .leftJoin(users, eq(users.id, inventorySettlementDrafts.preparedById))
        .leftJoin(
          warehouses,
          eq(warehouses.id, inventoryCountOperations.warehouseId)
        )
        .orderBy(desc(inventorySettlementDrafts.updatedAt))
        .limit(500);
    },
    async detail(actor: Actor, draftId: number) {
      assertActor(actor, "read");
      const db = await database();
      const rows = await db
        .select()
        .from(inventorySettlementDrafts)
        .where(eq(inventorySettlementDrafts.id, draftId))
        .limit(1);
      if (!rows[0]) fail("مسودة التسوية غير موجودة", "NOT_FOUND");
      const draft = rows[0];
      const [data, history, corrections] = await Promise.all([
        source(db, draft.sourceCountOperationId),
        db
          .select({
            id: inventorySettlementDraftEvents.id,
            draftId: inventorySettlementDraftEvents.draftId,
            version: inventorySettlementDraftEvents.version,
            action: inventorySettlementDraftEvents.action,
            actorId: inventorySettlementDraftEvents.actorId,
            actorName: users.name,
            reason: inventorySettlementDraftEvents.reason,
            payload: inventorySettlementDraftEvents.payload,
            createdAt: inventorySettlementDraftEvents.createdAt,
          })
          .from(inventorySettlementDraftEvents)
          .leftJoin(users, eq(users.id, inventorySettlementDraftEvents.actorId))
          .where(eq(inventorySettlementDraftEvents.draftId, draftId))
          .orderBy(desc(inventorySettlementDraftEvents.version)),
        db
          .select()
          .from(inventoryCountCorrections)
          .where(eq(inventoryCountCorrections.draftId, draftId))
          .orderBy(desc(inventoryCountCorrections.id)),
      ]);
      const parsed = corrections.map((row: any) => ({
        ...row,
        allowedCountItemIds: jsonValue(row.allowedCountItemIds),
        beforeSnapshot: jsonValue(row.beforeSnapshot),
        afterSnapshot: jsonValue(row.afterSnapshot),
      }));
      return {
        draft: {
          ...draft,
          submittedSnapshot: jsonValue(draft.submittedSnapshot),
          sourceChanged:
            !!draft.sourceFingerprint &&
            draft.sourceFingerprint !== data.fingerprint,
        },
        sourceCount: data.sourceCount,
        items: data.items,
        history,
        corrections: parsed,
        pendingCorrection:
          parsed.find((row: any) => row.status === "pending") || null,
      };
    },
    async saveDraft(actor: Actor, input: SaveInput) {
      assertActor(actor, "prepare");
      const reason = reasonText(input.reason);
      const reference = input.reference?.trim() || null;
      if (reference && reference.length > 255)
        fail("مرجع التسوية يجب ألا يتجاوز 255 حرفًا");
      const save = async (tx: any, draft?: any) => {
        if (draft) {
          ownership(actor, draft);
          version(draft, input.expectedVersion);
          if (
            draft.sourceCountOperationId !== input.sourceCountOperationId ||
            !settlementDraftEditable(draft.status)
          )
            fail("التسوية غير متاحة للتعديل", "CONFLICT");
          if (await pendingCorrection(tx, draft.id))
            fail("أكمل تصحيح الجرد المطلوب أولًا", "CONFLICT");
        }
        await noPostedSettlement(tx, input.sourceCountOperationId);
        const data = await source(tx, input.sourceCountOperationId);
        assertSource(data);
        await checkCorrects(tx, data, input.correctsSettlementId);
        const nextVersion = draft ? draft.version + 1 : 1;
        const values = {
          reason,
          reference,
          correctsSettlementId: input.correctsSettlementId || null,
          updatedAt: new Date(),
        };
        let id = draft?.id;
        if (!id) {
          const existing = await tx
            .select({ id: inventorySettlementDrafts.id })
            .from(inventorySettlementDrafts)
            .where(
              eq(
                inventorySettlementDrafts.sourceCountOperationId,
                input.sourceCountOperationId
              )
            )
            .limit(1);
          if (existing.length)
            fail(
              "توجد مسودة تسوية لهذا الجرد؛ افتحها من قائمة التسويات",
              "CONFLICT"
            );
          const [result] = await tx.insert(inventorySettlementDrafts).values({
            ...values,
            sourceCountOperationId: input.sourceCountOperationId,
            status: "draft",
            version: 1,
            preparedById: actor.id,
          });
          id = Number(result.insertId);
          if (!id) fail("تعذر حفظ مسودة التسوية");
        } else
          await tx
            .update(inventorySettlementDrafts)
            .set({ ...values, version: nextVersion })
            .where(eq(inventorySettlementDrafts.id, id));
        await event(
          tx,
          id,
          nextVersion,
          draft ? "edited" : "created",
          actor,
          reason,
          { ...values, snapshot: data.snapshot }
        );
        return { draftId: id, version: nextVersion };
      };
      if (input.draftId) return withDraft(input.draftId, save);
      const db = await database();
      return db.transaction(async (tx: any) => {
        await lockCount(tx, input.sourceCountOperationId);
        return save(tx);
      });
    },
    async submitDraft(actor: Actor, input: VersionInput) {
      assertActor(actor, "prepare");
      return withDraft(input.draftId, async (tx, draft) => {
        ownership(actor, draft);
        version(draft, input.expectedVersion);
        if (!settlementDraftEditable(draft.status))
          fail("التسوية ليست مسودة قابلة للإرسال", "CONFLICT");
        if (await pendingCorrection(tx, draft.id))
          fail("يجب استكمال تصحيح الجرد قبل الإرسال", "CONFLICT");
        await noPostedSettlement(tx, draft.sourceCountOperationId);
        const data = await source(tx, draft.sourceCountOperationId);
        assertSource(data);
        await checkCorrects(tx, data, draft.correctsSettlementId || undefined);
        const nextVersion = draft.version + 1;
        await tx
          .update(inventorySettlementDrafts)
          .set({
            status: "pending_review",
            version: nextVersion,
            submittedVersion: nextVersion,
            sourceFingerprint: data.fingerprint,
            submittedSnapshot: data.snapshot,
            lastSubmittedById: actor.id,
            submittedAt: new Date(),
            returnedReason: null,
          })
          .where(eq(inventorySettlementDrafts.id, draft.id));
        await event(tx, draft.id, nextVersion, "submitted", actor, null, {
          fingerprint: data.fingerprint,
          snapshot: data.snapshot,
          reason: draft.reason,
          reference: draft.reference,
        });
        return { draftId: draft.id, version: nextVersion };
      });
    },
    async returnDraft(actor: Actor, input: VersionInput & { reason: string }) {
      assertActor(actor, "review");
      const reason = reasonText(input.reason);
      return withDraft(input.draftId, async (tx, draft) => {
        version(draft, input.expectedVersion);
        if (draft.status !== "pending_review")
          fail("التسوية ليست بانتظار المراجعة", "CONFLICT");
        await noPostedSettlement(tx, draft.sourceCountOperationId);
        const nextVersion = draft.version + 1;
        await tx
          .update(inventorySettlementDrafts)
          .set({
            status: "returned",
            returnedReason: reason,
            version: nextVersion,
          })
          .where(eq(inventorySettlementDrafts.id, draft.id));
        await event(tx, draft.id, nextVersion, "returned", actor, reason, {
          submittedVersion: draft.submittedVersion,
        });
        return { draftId: draft.id, version: nextVersion };
      });
    },
    async approveDraft(actor: Actor, input: VersionInput) {
      assertActor(actor, "review");
      return withDraft(input.draftId, async (tx, draft) => {
        // An exact retry returns the original result; a later/stale edit cannot trigger another posting.
        if (
          (draft.status === "applied" || draft.status === "no_adjustment") &&
          draft.approvedById === actor.id &&
          input.expectedVersion === draft.version - 1
        )
          return {
            draftId: draft.id,
            version: draft.version,
            settlementId: draft.appliedSettlementId,
            alreadyApplied: true,
            noAdjustment: draft.status === "no_adjustment",
          };
        version(draft, input.expectedVersion);
        if (draft.status !== "pending_review")
          fail("التسوية ليست بانتظار المراجعة", "CONFLICT");
        if (
          draft.preparedById === actor.id ||
          draft.lastSubmittedById === actor.id
        )
          fail(
            "لا يجوز اعتماد التسوية التي أعددتها أو أرسلتها بنفسك",
            "FORBIDDEN"
          );
        const contributions = await tx
          .select({
            action: inventorySettlementDraftEvents.action,
            actorId: inventorySettlementDraftEvents.actorId,
          })
          .from(inventorySettlementDraftEvents)
          .where(eq(inventorySettlementDraftEvents.draftId, draft.id));
        const contributingActions = new Set([
          "created",
          "edited",
          "submitted",
          "count_corrected",
        ]);
        if (
          contributions.some(
            (entry: any) =>
              entry.actorId === actor.id &&
              contributingActions.has(entry.action)
          )
        ) {
          fail(
            "لا يجوز اعتماد تسوية شاركت في إعداد بياناتها أو تصحيح جردها؛ يلزم مراجع آخر",
            "FORBIDDEN"
          );
        }
        await noPostedSettlement(tx, draft.sourceCountOperationId);
        if (await pendingCorrection(tx, draft.id))
          fail("يوجد تصحيح جرد لم يكتمل", "CONFLICT");
        const countKinds = await tx
          .select({ countType: inventoryCountOperations.countType })
          .from(inventoryCountOperations)
          .where(eq(inventoryCountOperations.id, draft.sourceCountOperationId))
          .limit(1)
          .for("update");
        let currentOpeningCosts: Map<number, number> | undefined;
        if (countKinds[0]?.countType === "opening_balance") {
          const identities = await tx
            .select({ inventoryId: inventoryCountItems.inventoryId })
            .from(inventoryCountItems)
            .where(
              eq(inventoryCountItems.operationId, draft.sourceCountOperationId)
            );
          const ids = Array.from(
            new Set<number>(
              identities.map((row: any) => Number(row.inventoryId))
            )
          ).sort((a, b) => a - b);
          if (!ids.length) fail("لا يمكن اعتماد جرد فارغ");
          // A current locking read, after the canonical count -> draft locks, avoids
          // accepting an old MVCC average cost then posting with a newer writer cost.
          const currentRows = await tx
            .select({ id: inventory.id, averageCost: inventory.averageCost })
            .from(inventory)
            .where(inArray(inventory.id, ids))
            .orderBy(asc(inventory.id))
            .for("update");
          if (currentRows.length !== ids.length)
            fail("أحد أصناف الجرد لم يعد موجودًا", "CONFLICT");
          currentOpeningCosts = new Map<number, number>(
            currentRows.map((row: any) => [
              Number(row.id),
              Number(row.averageCost || 0),
            ])
          );
        }
        const data = await source(
          tx,
          draft.sourceCountOperationId,
          currentOpeningCosts
        );
        assertSource(data);
        if (
          !draft.sourceFingerprint ||
          draft.sourceFingerprint !== data.fingerprint
        )
          fail(
            "تغيرت نتائج الجرد بعد إرسال التسوية؛ أعدها للتعديل والمراجعة",
            "CONFLICT"
          );
        await checkCorrects(tx, data, draft.correctsSettlementId || undefined);
        if (!data.items.some((row: any) => row.diffQuantity !== 0)) {
          const nextVersion = draft.version + 1;
          await tx
            .update(inventorySettlementDrafts)
            .set({
              status: "no_adjustment",
              version: nextVersion,
              approvedById: actor.id,
              appliedAt: new Date(),
            })
            .where(eq(inventorySettlementDrafts.id, draft.id));
          await event(
            tx,
            draft.id,
            nextVersion,
            "no_adjustment",
            actor,
            draft.reason,
            { fingerprint: data.fingerprint, snapshot: data.snapshot }
          );
          return {
            draftId: draft.id,
            version: nextVersion,
            noAdjustment: true,
          };
        }
        const result = await deps.applySettlementWithWriter(
          {
            sourceType: "from_count",
            sourceCountOperationId: draft.sourceCountOperationId,
            reason: draft.reason,
            reference: draft.reference || undefined,
            appliedById: actor.id,
            items: data.items
              .filter((row: any) => row.diffQuantity !== 0)
              .map((row: any) => ({
                inventoryId: row.inventoryId,
                lotId: row.lotId || undefined,
                afterQuantity: row.countedQuantity!,
                lotNumber: row.lotNumber || undefined,
                expiryDate: row.expiryDate || undefined,
              })),
          },
          tx,
          draft.id
        );
        if (!result?.settlementId) fail("تعذر إثبات تطبيق التسوية", "CONFLICT");
        const nextVersion = draft.version + 1;
        await tx
          .update(inventorySettlementDrafts)
          .set({
            status: "applied",
            version: nextVersion,
            approvedById: actor.id,
            appliedAt: new Date(),
            appliedSettlementId: result.settlementId,
          })
          .where(eq(inventorySettlementDrafts.id, draft.id));
        await event(tx, draft.id, nextVersion, "applied", actor, draft.reason, {
          ...result,
          fingerprint: data.fingerprint,
          snapshot: data.snapshot,
          correctsSettlementId: draft.correctsSettlementId,
        });
        return { ...result, draftId: draft.id, version: nextVersion };
      });
    },
    async requestCountCorrection(
      actor: Actor,
      input: VersionInput & { reason: string; countItemIds: number[] }
    ) {
      assertActor(actor, "review");
      const reason = reasonText(input.reason);
      const ids = Array.from(new Set(input.countItemIds));
      if (
        !ids.length ||
        ids.length !== input.countItemIds.length ||
        ids.some(id => !Number.isSafeInteger(id) || id <= 0)
      )
        fail("حدد أصناف الجرد المطلوب تصحيحها دون تكرار");
      return withDraft(input.draftId, async (tx, draft) => {
        version(draft, input.expectedVersion);
        if (draft.status !== "pending_review")
          fail("طلب تصحيح الجرد متاح أثناء مراجعة التسوية فقط", "CONFLICT");
        await noPostedSettlement(tx, draft.sourceCountOperationId);
        if (await pendingCorrection(tx, draft.id))
          fail("يوجد طلب تصحيح مفتوح لهذا الجرد", "CONFLICT");
        const data = await source(tx, draft.sourceCountOperationId);
        assertSource(data);
        if (
          ids.some(id => !data.items.some((row: any) => row.countItemId === id))
        )
          fail("أحد الأصناف لا ينتمي للجرد المصدر", "FORBIDDEN");
        const [result] = await tx.insert(inventoryCountCorrections).values({
          draftId: draft.id,
          operationId: draft.sourceCountOperationId,
          requestedById: actor.id,
          requestedReason: reason,
          allowedCountItemIds: ids,
          sourceFingerprint: data.fingerprint,
          beforeSnapshot: data.snapshot,
          status: "pending",
        });
        const requestId = Number(result.insertId);
        if (!requestId) fail("تعذر إنشاء طلب التصحيح");
        const nextVersion = draft.version + 1;
        await tx
          .update(inventorySettlementDrafts)
          .set({
            status: "returned",
            returnedReason: reason,
            version: nextVersion,
          })
          .where(eq(inventorySettlementDrafts.id, draft.id));
        await event(
          tx,
          draft.id,
          nextVersion,
          "correction_requested",
          actor,
          reason,
          { requestId, allowedCountItemIds: ids, beforeSnapshot: data.snapshot }
        );
        return { draftId: draft.id, requestId, version: nextVersion };
      });
    },
    async saveCountCorrection(
      actor: Actor,
      input: {
        requestId: number;
        reason: string;
        items: Array<{ countItemId: number; countedQuantity: number }>;
      }
    ) {
      assertActor(actor, "prepare");
      const reason = reasonText(input.reason);
      const ids = input.items.map(row => row.countItemId);
      if (!ids.length || new Set(ids).size !== ids.length)
        fail("أدخل الأصناف المصرح بتصحيحها دون تكرار");
      for (const row of input.items) reviewedQuantity(row.countedQuantity);
      const db = await database();
      const requests = await db
        .select({ draftId: inventoryCountCorrections.draftId })
        .from(inventoryCountCorrections)
        .where(eq(inventoryCountCorrections.id, input.requestId))
        .limit(1);
      if (!requests[0]) fail("طلب تصحيح الجرد غير موجود", "NOT_FOUND");
      return withDraft(requests[0].draftId, async (tx, draft) => {
        ownership(actor, draft);
        if (draft.status !== "returned")
          fail("التسوية ليست معادة للتصحيح", "CONFLICT");
        await noPostedSettlement(tx, draft.sourceCountOperationId);
        const request = await pendingCorrection(tx, draft.id);
        if (
          !request ||
          request.id !== input.requestId ||
          request.operationId !== draft.sourceCountOperationId
        )
          fail("طلب التصحيح غير مفتوح لهذه التسوية", "CONFLICT");
        const allowed = jsonValue(request.allowedCountItemIds) as number[];
        if (
          !Array.isArray(allowed) ||
          ids.length !== allowed.length ||
          ids.some(id => !allowed.includes(id))
        )
          fail(
            "التصحيح يقتصر على جميع الأصناف المحددة من المراجع",
            "FORBIDDEN"
          );
        const before = await source(tx, draft.sourceCountOperationId);
        if (before.fingerprint !== request.sourceFingerprint)
          fail("تغير الجرد منذ طلب التصحيح؛ يلزم مراجعة جديدة", "CONFLICT");
        for (const proposed of input.items) {
          const original = before.items.find(
            (row: any) => row.countItemId === proposed.countItemId
          );
          if (!original) fail("الصنف لا ينتمي للجرد المصدر", "FORBIDDEN");
          const next = reviewedQuantity(proposed.countedQuantity);
          await tx
            .update(inventoryCountItems)
            .set({
              countedQuantity: next.toFixed(3),
              diffQuantity: quantity(next - original.systemQuantity).toFixed(3),
              countedById: actor.id,
              countedAt: new Date(),
            })
            .where(
              and(
                eq(inventoryCountItems.id, proposed.countItemId),
                eq(
                  inventoryCountItems.operationId,
                  draft.sourceCountOperationId
                )
              )
            );
        }
        const after = await source(tx, draft.sourceCountOperationId);
        // Snapshot quantities/costs and completedAt remain the original observation, not a new count time.
        const totals = {
          totalItemsCounted: after.items.filter(
            (row: any) => row.countedQuantity != null
          ).length,
          totalDiscrepancies: after.items.filter(
            (row: any) => row.diffQuantity !== 0
          ).length,
        };
        await tx
          .update(inventoryCountOperations)
          .set(totals)
          .where(eq(inventoryCountOperations.id, draft.sourceCountOperationId));
        Object.assign(after.sourceCount, totals);
        await tx
          .update(inventoryCountCorrections)
          .set({
            status: "corrected",
            correctedById: actor.id,
            correctionReason: reason,
            correctedAt: new Date(),
            afterSnapshot: after.snapshot,
          })
          .where(eq(inventoryCountCorrections.id, request.id));
        const nextVersion = draft.version + 1;
        await tx
          .update(inventorySettlementDrafts)
          .set({ version: nextVersion })
          .where(eq(inventorySettlementDrafts.id, draft.id));
        await event(
          tx,
          draft.id,
          nextVersion,
          "count_corrected",
          actor,
          reason,
          {
            requestId: request.id,
            beforeSnapshot: jsonValue(request.beforeSnapshot),
            afterSnapshot: after.snapshot,
          }
        );
        return { draftId: draft.id, version: nextVersion };
      });
    },
  };
}
