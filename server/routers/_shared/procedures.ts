import { publicProcedure, protectedProcedure, router } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { APP_ROLE } from "@shared/roles";

export { publicProcedure, protectedProcedure, router };

const roleMiddleware = (allowedRoles: string[]) => {
  return protectedProcedure.use(({ ctx, next }) => {
    if (
      !allowedRoles.includes(ctx.user.role) &&
      ctx.user.role !== APP_ROLE.ADMIN &&
      ctx.user.role !== APP_ROLE.OWNER
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ليس لديك صلاحية لهذا الإجراء",
      });
    }
    return next({ ctx });
  });
};

const denyRolesMiddleware = (deniedRoles: string[]) => {
  return protectedProcedure.use(({ ctx, next }) => {
    if (deniedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية للوصول إلى هذا القسم" });
    }
    return next({ ctx });
  });
};

/** Shared manager capabilities outside ticket-specific modules. */
export const managerProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.PURCHASE_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/**
 * Generic ticket actions remain unavailable to the construction role unless a
 * router explicitly loads the ticket and applies the per-ticket routing guard.
 */
export const ticketProcedure = denyRolesMiddleware([
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
]);

/** Only the general-maintenance side (plus legacy/admin/owner) routes new reports. */
export const ticketTriageProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/** Ticket workflow is retained by the legacy and general-maintenance roles only. */
export const ticketManagerProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

export const supervisorProcedure = roleMiddleware([
  APP_ROLE.SUPERVISOR,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

export const gateSecurityProcedure = roleMiddleware([
  APP_ROLE.GATE_SECURITY,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

export const accountantProcedure = roleMiddleware([
  APP_ROLE.ACCOUNTANT,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

export const managementProcedure = roleMiddleware([
  APP_ROLE.SENIOR_MANAGEMENT,
  APP_ROLE.EXECUTIVE_DIRECTOR,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

// صلاحية الفرز والتصنيف بمركز التحسين والتطوير: عائلة مدير الصيانة فقط.
export const ideaTriageProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
]);

export const warehouseProcedure = roleMiddleware([
  APP_ROLE.WAREHOUSE,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/**
 * قائمة فارغة تعني عمليًا "أدمن ومالك فقط" — roleMiddleware يسمح بهما دائمًا
 * بغض النظر عن القائمة الممرَّرة (راجع أعلى الملف). تُستخدم لعمليات حسّاسة
 * لا يجب أن يصل إليها حتى دور warehouse العادي، مثل تعديل مسمى مخزن فرعي.
 */
export const adminOwnerProcedure = roleMiddleware([]);

export const delegateProcedure = roleMiddleware([
  APP_ROLE.DELEGATE,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/**
 * Read-only catalog data is still available to the general-maintenance role
 * because purchase-order creation uses catalog nodes/items/units internally.
 * The standalone catalog module and all catalog mutations remain excluded.
 */
export const catalogReadProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.PURCHASE_MANAGER,
  APP_ROLE.PURCHASE_REQUESTER,
  APP_ROLE.WAREHOUSE,
  APP_ROLE.FOOD_WAREHOUSE_MANAGER,
  APP_ROLE.FOOD_WAREHOUSE_ASSISTANT,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/** Catalog management is excluded from the general-maintenance derived role. */
export const catalogProcedure = roleMiddleware([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.PURCHASE_MANAGER,
  APP_ROLE.PURCHASE_REQUESTER,
  APP_ROLE.WAREHOUSE,
  APP_ROLE.FOOD_WAREHOUSE_MANAGER,
  APP_ROLE.FOOD_WAREHOUSE_ASSISTANT,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

/** Construction keeps existing project-member behavior, but denies the general role. */
export const constructionProcedure = denyRolesMiddleware([
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
]);

/** Both derived roles explicitly exclude warehouse/inventory modules. */
export const inventoryReadProcedure = denyRolesMiddleware([
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
]);
