import { describe, expect, it } from "vitest";
import { isTicketVisible, assertTicketVisible, isRoleDeniedFromTickets } from "../routers/tickets/tickets.access";

// ══════════════════════════════════════════════════════════════════════════
// اختبارات حارس رؤية البلاغات — يطابق نطاق list()/listPaginated حرفيًا
// ══════════════════════════════════════════════════════════════════════════

const ticket = (over: Partial<any> = {}) => ({
  reportedById: 10,
  assignedToId: 20,
  assignedTechnicianId: null,
  ...over,
});

describe("operator — مقيّد ببلاغاته التي أبلغ عنها", () => {
  it("يرى بلاغه هو", () => {
    expect(isTicketVisible({ id: 10, role: "operator" }, ticket())).toBe(true);
  });
  it("🔴 لا يرى بلاغ مشغّل آخر (الثغرة المُغلَقة)", () => {
    expect(isTicketVisible({ id: 11, role: "operator" }, ticket())).toBe(false);
  });
});

describe("technician — مقيّد بالبلاغات المسنَدة له", () => {
  it("يرى البلاغ المسنَد له عبر assignedToId", () => {
    expect(isTicketVisible({ id: 20, role: "technician" }, ticket())).toBe(true);
  });
  it("يرى البلاغ المسنَد له عبر assignedTechnicianId أيضًا", () => {
    expect(
      isTicketVisible({ id: 30, role: "technician" }, ticket({ assignedToId: null, assignedTechnicianId: 30 }))
    ).toBe(true);
  });
  it("🔴 لا يرى بلاغًا مسنَدًا لفني آخر", () => {
    expect(isTicketVisible({ id: 21, role: "technician" }, ticket())).toBe(false);
  });
  it("🔴 لا يرى بلاغًا غير مسنَد لأحد", () => {
    expect(
      isTicketVisible({ id: 20, role: "technician" }, ticket({ assignedToId: null }))
    ).toBe(false);
  });
});

describe("باقي الأدوار — بلا تقييد (مطابقة حرفية لسلوك list الحالي)", () => {
  for (const role of ["maintenance_manager", "owner", "admin", "supervisor", "gate_security"]) {
    it(`${role} يرى أي بلاغ`, () => {
      expect(isTicketVisible({ id: 999, role }, ticket())).toBe(true);
    });
  }
});

describe("🔒 الأدوار المحجوبة عن البلاغات بالواجهة — ممنوعة الآن بالخادم أيضًا", () => {
  const denied = [
    "accountant", "purchase_manager", "warehouse",
    "purchase_requester", "food_warehouse_manager", "food_warehouse_assistant",
  ];
  for (const role of denied) {
    it(`${role} ممنوع كليًا — حتى لو كان هو المُبلِّغ أو المسنَد له`, () => {
      expect(isRoleDeniedFromTickets(role)).toBe(true);
      expect(isTicketVisible({ id: 999, role }, ticket())).toBe(false);
      expect(isTicketVisible({ id: 10, role }, ticket())).toBe(false);
      expect(isTicketVisible({ id: 20, role }, ticket())).toBe(false);
    });
  }

  it("الأدوار المسموح لها بالواجهة ليست ضمن قائمة المنع", () => {
    for (const role of ["operator", "technician", "maintenance_manager", "supervisor", "gate_security", "delegate", "senior_management", "executive_director", "owner", "admin"]) {
      expect(isRoleDeniedFromTickets(role)).toBe(false);
    }
  });
});

describe("assertTicketVisible", () => {
  it("يرمي FORBIDDEN عند الرفض", () => {
    expect(() => assertTicketVisible({ id: 11, role: "operator" }, ticket())).toThrow();
  });
  it("لا يرمي شيئًا عند السماح", () => {
    expect(() => assertTicketVisible({ id: 10, role: "operator" }, ticket())).not.toThrow();
  });
});
