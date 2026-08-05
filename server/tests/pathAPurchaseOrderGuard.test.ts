import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 77,
    openId: "path-a-manager",
    email: "path-a@test.local",
    name: "Path A Manager",
    loginMethod: "manus",
    role: "maintenance_manager",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

const tickets = [{ id: 501, ticketNumber: "MT-0501", maintenancePath: "A", status: "work_approved" }];
const purchaseOrders = [{ id: 601, poNumber: "PR-0601", ticketId: 501, status: "draft", requestedById: 77 }];

vi.mock("../_core/db", () => ({
  getTicketById: vi.fn(async (id: number) => tickets.find((ticket) => ticket.id === id) || null),
  getPurchaseOrderById: vi.fn(async (id: number) => purchaseOrders.find((po) => po.id === id) || null),
  getNextPONumber: vi.fn(async () => "PR-9999"),
  getPOItems: vi.fn(async () => [{ id: 1, purchaseOrderId: 601, itemName: "صنف" }]),
}));

const db = await import("../_core/db") as any;

describe("Path A purchase-order guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects direct creation linked to a path A ticket before generating a PO number", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.purchaseOrders.create({
      ticketId: 501,
      items: [{ itemName: "قطعة غيار", quantity: 1 }],
    })).rejects.toThrow("المسار B");
    expect(db.getNextPONumber).not.toHaveBeenCalled();
  });

  it("rejects saving a draft linked to a path A ticket", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.purchaseOrders.saveDraft({
      ticketId: 501,
      items: [{ itemName: "قطعة غيار", quantity: 1 }],
    })).rejects.toThrow("المسار B");
    expect(db.getNextPONumber).not.toHaveBeenCalled();
  });

  it("rejects submitting an existing draft linked to a path A ticket", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.purchaseOrders.submitDraft({ id: 601 })).rejects.toThrow("المسار B");
    expect(db.getPOItems).not.toHaveBeenCalled();
  });
});
