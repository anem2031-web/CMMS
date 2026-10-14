import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const router = read("server/routers/tickets/tickets.router.ts");
const workflow = read("server/routers/tickets/tickets.workflow.ts");
const teamRouter = read("server/routers/tickets/it-team.router.ts");
const teamService = read("server/routers/tickets/it-team.service.ts");
const purchaseWorkflow = read("server/routers/purchase/ticket-purchase-workflow.ts");
const purchaseRouter = read("server/routers/purchase/purchase-orders.router.ts");
const detail = read("client/src/pages/tickets/TicketDetail.tsx");
const teamPanel = read("client/src/pages/tickets/ItTeamPanel.tsx");

function block(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test("direct IT creation enters an unclaimed shared department queue", () => {
  const helper = block(router, "async function createDirectItPlanningTicket", "async function recordDirectItRouting");
  assert.match(helper, /status:\s*"department_planning"/);
  assert.match(helper, /department:\s*MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
  assert.match(helper, /assignedToId:\s*null/);
  assert.doesNotMatch(helper, /claimedById:/);
  assert.doesNotMatch(helper, /createTicketTask/);
});

test("ticket arrival notifies the active IT manager and active IT members through the single explicit opt-in", () => {
  assert.match(teamService, /getUsersByRole\(APP_ROLE\.IT_MANAGER\)/);
  assert.match(teamService, /getUsersByRole\(APP_ROLE\.IT_MEMBER\)/);
  assert.match(teamService, /user\.isActive !== 0/);
  assert.match(teamService, /for \(const user of recipients\.values\(\)\)/);
  assert.match(teamService, /userId:\s*user\.id/);
  assert.match(teamService, /allowItManager:\s*true/);
  const recorder = block(router, "async function recordDirectItRouting", "export const ticketsRouter");
  assert.match(recorder, /notifyItTeamArrival\(args\.parentId, args\.ticketNumber\)/);
});

test("first claim wins atomically and becomes the operational assignee", () => {
  const claim = block(teamRouter, "claimItTicket:", "handoverItTicket:");
  assert.match(claim, /lockTicketForSubTicketSequence/);
  assert.match(claim, /lockTicketDepartmentForTaskSequence/);
  assert.match(claim, /isNull\(ticketDepartments\.claimedById\)/);
  assert.match(claim, /affectedRows !== 1/);
  assert.match(claim, /assignedToId:\s*ctx\.user\.id/);
  assert.match(claim, /syncSingleTicketItem/);
});

test("IT tasks can be assigned to exactly one active team member without assignment notification", () => {
  const createTask = block(workflow, "createDepartmentTask:", "assignDepartmentTask:");
  assert.match(createTask, /freshDepartment\.claimedById/);
  assert.match(createTask, /autoAssignedToItTeamMember/);
  const assignTask = block(workflow, "assignDepartmentTask:", "promoteDepartmentTask:");
  assert.match(assignTask, /input\.technicianIds\.length !== 1/);
  assert.match(assignTask, /assertActiveItUser/);
  assert.match(assignTask, /department\.department !== MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
});

test("assigned manager or member executes the normal child A/B/C workflow and self-approves inspection", () => {
  const promote = block(workflow, "promoteDepartmentTask:", "تصحيح بلاغ صُنّف IT بالخطأ");
  assert.match(promote, /isItTeamRole\(ctx\.user\.role\)/);
  assert.match(promote, /workflowModel:\s*"sub_ticket"/);
  assert.match(promote, /inspectionWorkflowStatus:\s*MAINTENANCE_INSPECTION_WORKFLOW_STATUS\.PENDING_SUBMISSION/);
  assert.match(workflow, /shouldAutoApproveRecordedInspection/);
  assert.match(detail, /isItTeamRole\(role\)/);
  assert.match(teamPanel, /t\.workflow\.ticket\.startTaskCreateSubTicket/);
});

test("member raises a purchase need while only the responsible manager creates the formal order", () => {
  assert.match(purchaseWorkflow, /user\.role === APP_ROLE\.IT_MEMBER/);
  assert.match(purchaseWorkflow, /ارفع احتياج الشراء إلى مدير تقنية المعلومات/);
  const submit = block(teamRouter, "submitItPurchaseNeed:", "returnItPurchaseNeed:");
  assert.match(submit, /ctx\.user\.role !== APP_ROLE\.IT_MEMBER/);
  assert.match(submit, /maintenancePath !== "B"/);
  assert.match(submit, /itPurchaseNeeds/);
  const create = block(purchaseRouter, "create: protectedProcedure", "delete: protectedProcedure");
  assert.match(create, /itPurchaseNeedId/);
  assert.match(create, /ctx\.user\.role !== APP_ROLE\.IT_MANAGER/);
  assert.match(create, /status:\s*"ordered"/);
  assert.match(teamPanel, /t\.workflow\.ticket\.submitNeedToItManager/);
  assert.match(teamPanel, /t\.workflow\.ticket\.createOfficialPo/);
});

test("maintenance and construction managers can reroute an untouched maintenance ticket to the IT queue", () => {
  const transfer = block(teamRouter, "routeGeneralTicketToIt:", "itPurchaseNeeds:");
  assert.match(transfer, /GENERAL_MAINTENANCE_MANAGER/);
  assert.match(transfer, /CONSTRUCTION_PROCUREMENT_MANAGER/);
  assert.match(transfer, /DEPT\.GENERAL, DEPT\.CONSTRUCTION/);
  assert.match(transfer, /!\["pending_triage", "department_planning", "under_inspection"\]\.includes/);
  assert.match(transfer, /purchase_orders/);
  assert.match(transfer, /department:\s*DEPT\.IT/);
  assert.match(transfer, /claimedById:\s*null/);
  assert.match(transfer, /notifyItTeamArrival/);
  assert.match(teamPanel, /APP_ROLE\.CONSTRUCTION_PROCUREMENT_MANAGER/);
});
