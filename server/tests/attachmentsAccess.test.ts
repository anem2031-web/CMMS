import { describe, expect, it, vi, beforeEach } from "vitest";

// ══════════════════════════════════════════════════════════════════════════
// اختبارات إصلاح ثغرة IDOR بالمرفقات (attachments.list / attachments.add)
// ══════════════════════════════════════════════════════════════════════════

const ideas: any[] = [];
const tickets: any[] = [];

vi.mock("../services/improvement-ideas/improvementIdeas", () => ({
  getImprovementIdeaById: vi.fn(async (id: number) => ideas.find((i) => i.id === id) || null),
}));

vi.mock("../_core/db", () => ({
  getTicketById: vi.fn(async (id: number) => tickets.find((t) => t.id === id) || null),
}));

const { assertCanAccessAttachments, ALLOWED_ATTACHMENT_ENTITY_TYPES } = await import(
  "../routers/uploads/attachments.access"
);

beforeEach(() => {
  ideas.length = 0;
  tickets.length = 0;
  // فكرة تحسين قدّمها الموظف رقم 1
  ideas.push({ id: 50, submittedById: 1, title: "مقترح سري" });
  // بلاغ أبلغ عنه المشغّل رقم 10، ومسنَد للفني رقم 20
  tickets.push({ id: 70, reportedById: 10, assignedToId: 20, assignedTechnicianId: null });
});

describe("قائمة السماح لأنواع الكيانات (Default Deny)", () => {
  it("يقبل الأنواع المدعومة فقط", async () => {
    expect(ALLOWED_ATTACHMENT_ENTITY_TYPES).toEqual(["ticket", "improvement_idea", "catalog_item"]);
  });

  it("يرفض أي نوع كيان غير مذكور بالقائمة", async () => {
    await expect(
      assertCanAccessAttachments({ id: 1, role: "owner" }, "purchase_order", 1)
    ).rejects.toThrow();
    await expect(
      assertCanAccessAttachments({ id: 1, role: "owner" }, "random_made_up_type", 1)
    ).rejects.toThrow();
  });
});

describe("improvement_idea — الثغرة الحقيقية المُغلَقة", () => {
  it("🔴 موظف آخر لا يقدر يستعرض مرفقات مقترح ليس له (كان مسموحًا قبل الإصلاح)", async () => {
    await expect(
      assertCanAccessAttachments({ id: 2, role: "technician" }, "improvement_idea", 50)
    ).rejects.toThrow();
  });

  it("صاحب المقترح نفسه مسموح له", async () => {
    await expect(
      assertCanAccessAttachments({ id: 1, role: "technician" }, "improvement_idea", 50)
    ).resolves.toBeUndefined();
  });

  it("أدوار الرؤية الكاملة مسموح لها (نفس قائمة وحدة المقترحات حرفيًا)", async () => {
    for (const role of ["maintenance_manager", "senior_management", "executive_director", "owner", "admin"]) {
      await expect(
        assertCanAccessAttachments({ id: 99, role }, "improvement_idea", 50)
      ).resolves.toBeUndefined();
    }
  });

  it("دور غير مميّز وغير صاحب المقترح يُرفض حتى لو كان محاسبًا/مندوبًا", async () => {
    for (const role of ["accountant", "delegate", "warehouse", "purchase_requester"]) {
      await expect(
        assertCanAccessAttachments({ id: 2, role }, "improvement_idea", 50)
      ).rejects.toThrow();
    }
  });

  it("مقترح غير موجود يرمي NOT_FOUND", async () => {
    await expect(
      assertCanAccessAttachments({ id: 1, role: "owner" }, "improvement_idea", 9999)
    ).rejects.toThrow();
  });
});

describe("ticket — أصبح مقيَّدًا بعد إغلاق tickets.getById (2026-07-28)", () => {
  it("🔴 مشغّل آخر لا يقدر يستعرض مرفقات بلاغ ليس بلاغه", async () => {
    await expect(
      assertCanAccessAttachments({ id: 99, role: "operator" }, "ticket", 70)
    ).rejects.toThrow();
  });

  it("المشغّل صاحب البلاغ مسموح له", async () => {
    await expect(
      assertCanAccessAttachments({ id: 10, role: "operator" }, "ticket", 70)
    ).resolves.toBeUndefined();
  });

  it("الفني المسنَد له البلاغ مسموح له، وفني آخر يُمنع", async () => {
    await expect(
      assertCanAccessAttachments({ id: 20, role: "technician" }, "ticket", 70)
    ).resolves.toBeUndefined();
    await expect(
      assertCanAccessAttachments({ id: 21, role: "technician" }, "ticket", 70)
    ).rejects.toThrow();
  });

  it("الأدوار غير المقيَّدة (مدير صيانة/مالك) مسموح لها — مطابقة لسلوك list()", async () => {
    await expect(
      assertCanAccessAttachments({ id: 99, role: "maintenance_manager" }, "ticket", 70)
    ).resolves.toBeUndefined();
  });
});

describe("catalog_item — بلا فحص ملكية (مطابقة مقصودة لوحدته)", () => {
  it("أي مستخدم مسجّل دخول مسموح له (بيانات مرجعية مشتركة)", async () => {
    await expect(
      assertCanAccessAttachments({ id: 55, role: "technician" }, "catalog_item", 1)
    ).resolves.toBeUndefined();
  });
});
