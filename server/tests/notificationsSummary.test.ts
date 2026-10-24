import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("../_core/db", () => dbMocks);

import { notificationsRouter } from "../routers/notifications/notifications.router";
import { router } from "../_core/trpc";

const testRouter = router({ notifications: notificationsRouter });

const actor = {
  id: 44,
  openId: "notification-test-user",
  name: "Notification Test",
  role: "admin",
  isActive: 1,
};

function caller(user: typeof actor | null = actor) {
  return testRouter.createCaller({
    user,
    authenticatedUser: user,
    req: { protocol: "https", headers: {} },
    res: {},
  } as any);
}

function roleCaller(role: string) {
  return caller({ ...actor, role });
}

describe("notifications.summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the current user's list and unread count in one protected RPC", async () => {
    dbMocks.getUserNotifications.mockResolvedValue([{ id: 7, isRead: false }]);
    dbMocks.getUnreadNotificationCount.mockResolvedValue(3);

    await expect(caller().notifications.summary()).resolves.toEqual({
      items: [{ id: 7, isRead: false }],
      unreadCount: 3,
    });
    expect(dbMocks.getUserNotifications).toHaveBeenCalledOnce();
    expect(dbMocks.getUserNotifications).toHaveBeenCalledWith(actor.id, undefined);
    expect(dbMocks.getUnreadNotificationCount).toHaveBeenCalledOnce();
    expect(dbMocks.getUnreadNotificationCount).toHaveBeenCalledWith(actor.id, undefined);
  });

  it("denies the aggregate read when there is no authenticated user", async () => {
    await expect(caller(null).notifications.summary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.getUserNotifications).not.toHaveBeenCalled();
    expect(dbMocks.getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it.each([
    "accountant",
    "senior_management",
    "executive_director",
    "warehouse",
    "food_warehouse_assistant",
    "technician",
    "gate_security",
    "delegate",
    "observer",
  ])(
    "preserves the existing notification read grant for %s",
    async role => {
      dbMocks.getUserNotifications.mockResolvedValue([]);
      dbMocks.getUnreadNotificationCount.mockResolvedValue(0);
      await expect(roleCaller(role).notifications.summary()).resolves.toEqual({ items: [], unreadCount: 0 });
    },
  );
});
