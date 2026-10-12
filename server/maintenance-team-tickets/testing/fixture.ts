import type { Snapshot } from "../../../shared/maintenance-team-tickets/model";
import { MemoryStore } from "./memory-store";
import { MaintenanceTeamTicketService } from "../service";
import { TicketTeamManagementService } from "../team-management/service";
import { previewTeamRepository } from "./team-management-memory";

export function createDemo() {
  const location = { siteId: 1, sectionId: 11, assetId: 111 };
  const state: Snapshot = {
    users: [
      {
        id: 1,
        name: "مسؤول الصيانة",
        role: "maintenance_manager",
        active: true,
      },
      { id: 2, name: "أمين المستودع", role: "warehouse", active: true },
      { id: 3, name: "أحمد", role: "technician", active: true },
      { id: 4, name: "خالد", role: "technician", active: true },
      { id: 5, name: "فني فريق آخر", role: "technician", active: true },
      { id: 6, name: "مسؤول آخر", role: "maintenance_manager", active: true },
      { id: 7, name: "فني معطل", role: "technician", active: false },
    ],
    warehouses: [
      { id: 10, name: "المستودع الرئيسي", active: true },
      { id: 20, name: "مستودع فريق الصيانة", active: true },
      { id: 30, name: "مستودع الفريق الآخر", active: true },
    ],
    catalog: [
      { id: 101, name: "قاطع كهربائي", unit: "قطعة", active: true },
      { id: 102, name: "فلتر تكييف", unit: "قطعة", active: true },
      { id: 103, name: "حساس حرارة", unit: "قطعة", active: true },
    ],
    locations: [location],
    tickets: [
      {
        ticketId: 1001,
        ticketItemId: 5001,
        ticketNumber: "SIM-MT-001",
        title: "عطل لوحة الإنارة",
        location,
        responsibleManagerId: 1,
        closed: false,
        assignmentMode: "unassigned",
      },
      {
        ticketId: 1002,
        ticketItemId: 5002,
        ticketNumber: "SIM-MT-002",
        title: "ضعف تبريد المكيف",
        location,
        responsibleManagerId: 1,
        closed: false,
        assignmentMode: "unassigned",
      },
      {
        ticketId: 1003,
        ticketItemId: 5003,
        ticketNumber: "SIM-MT-003",
        title: "فحص حساس الحرارة",
        location,
        responsibleManagerId: 1,
        closed: false,
        assignmentMode: "unassigned",
      },
      {
        ticketId: 1004,
        ticketItemId: 5004,
        ticketNumber: "SIM-NAMED-004",
        title: "تذكرة مسندة بالاسم — خارج الطبقة",
        location,
        responsibleManagerId: 1,
        closed: false,
        assignmentMode: "name",
      },
    ],
    teams: [
      {
        id: 21,
        name: "فريق الصيانة العامة",
        warehouseId: 20,
        active: true,
        createdById: 1,
        updatedById: 1,
      },
      {
        id: 22,
        name: "فريق آخر",
        warehouseId: 30,
        active: true,
        createdById: 1,
        updatedById: 1,
      },
    ],
    memberships: [
      {
        teamId: 21,
        userId: 3,
        active: true,
        joinedAt: "2026-10-08T00:00:00Z",
        leftAt: null,
        updatedById: 1,
      },
      {
        teamId: 21,
        userId: 4,
        active: true,
        joinedAt: "2026-10-08T00:00:00Z",
        leftAt: null,
        updatedById: 1,
      },
      {
        teamId: 22,
        userId: 5,
        active: true,
        joinedAt: "2026-10-08T00:00:00Z",
        leftAt: null,
        updatedById: 1,
      },
    ],
    assignments: [],
    actions: [],
    needs: [],
    deliveries: [],
    supplies: [],
    returns: [],
    operations: [],
    nextId: 100,
  };
  const store = new MemoryStore(state, [
    {
      id: 1,
      warehouseId: 20,
      catalogItemId: 101,
      quantity: 2,
      originalCost: 5,
    },
    {
      id: 2,
      warehouseId: 20,
      catalogItemId: 101,
      quantity: 3,
      originalCost: 7,
    },
    {
      id: 3,
      warehouseId: 20,
      catalogItemId: 102,
      quantity: 1,
      originalCost: 9,
    },
    {
      id: 4,
      warehouseId: 10,
      catalogItemId: 102,
      quantity: 8,
      originalCost: 9,
    },
  ]);
  return {
    store,
    service: new MaintenanceTeamTicketService(store),
    teamManagement: new TicketTeamManagementService(
      previewTeamRepository(store)
    ),
  };
}
