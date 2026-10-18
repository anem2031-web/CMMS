import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { APP_ROLE, isItTeamRole, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "../../shared/roles";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

vi.mock("../_core/db", () => ({}));
import { isTicketReadOnlyForUser } from "../routers/tickets/tickets.access";

// Use the actual page predicates and banner expression. No app, API, database,
// permission override, or claim mutation is loaded or invoked by this UI check.
const source = readFileSync("client/src/pages/tickets/TicketDetail.tsx", "utf8");
const ast = ts.createSourceFile("TicketDetail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "isManagedConstructionTicket", "isItDepartmentTicket", "isWaitingForItTeamClaim", "isLinkedTicketReadOnly",
  "isItReadOnlyForMaintenanceManagers", "isRoutedConstructionReadOnlyForGeneral", "isTicketReadOnly",
]);
const declarations: string[] = [];
let banner = "";
function findBanner(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && names.has(node.name.getText(ast))) declarations.push(`const ${node.getText(ast)};`);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && node.left.getText(ast) === "isTicketReadOnly") banner = node.getText(ast);
  ts.forEachChild(node, findBanner);
}
findBanner(ast);
const compiled = ts.transpileModule(`${declarations.join("\n")} (${banner});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const waitingTicket = {
  id: 1, status: "department_planning", workflowModel: "department_tasks", reportedById: 200,
  assignedToId: null, maintenanceResponsibleDepartment: DEPT.IT, maintenanceResponsibleManagerId: 101,
};
function renderBanner(role: string, ticket: any = waitingTicket, translation: typeof ar | typeof en | typeof ur = ar, userId = 101) {
  if (declarations.length !== names.size || !banner) throw new Error("Actual page banner not found");
  return renderToStaticMarkup(vm.runInNewContext(compiled, {
    React, user: { id: userId, role }, ticket, ticketItems: [], departmentPlan: { departments: [] },
    APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT: DEPT, isItTeamRole, t: translation,
  }));
}

describe("IT read-only banner follows the actual ticket department and claim state", () => {
  it.each([ar, en, ur])("uses the waiting-for-IT-claim text in each supported language", translation => {
    const html = renderBanner(APP_ROLE.IT_MANAGER, waitingTicket, translation);
    expect(html).toContain(translation.workflow.ticket.waitingForItTeamClaim);
    expect(html).not.toContain(translation.workflow.ticket.readOnlyConstruction);
  });
  it.each([APP_ROLE.IT_MANAGER, APP_ROLE.IT_MEMBER, APP_ROLE.MAINTENANCE_MANAGER, APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, APP_ROLE.SUPERVISOR])(
    "shows the correct waiting message for a read-only %s", role => {
      expect(renderBanner(role)).toContain("البلاغ بانتظار استلام أحد أعضاء فريق تقنية المعلومات.");
    },
  );
  it.each([ar, en, ur])("uses the responsible IT member text after claim without naming Construction", translation => {
    const claimed = { ...waitingTicket, assignedToId: 101 };
    const html = renderBanner(APP_ROLE.IT_MEMBER, claimed, translation, 102);
    expect(html).toContain(translation.workflow.ticket.readOnlyIt);
    expect(html).not.toContain(translation.workflow.ticket.waitingForItTeamClaim);
    expect(html).not.toContain(translation.workflow.ticket.readOnlyConstruction);
  });
  it.each(["closed", "requester_confirmed"])("does not describe a %s unassigned ticket as awaiting claim", status => {
    const html = renderBanner(APP_ROLE.IT_MEMBER, { ...waitingTicket, status });
    expect(html).toContain(ar.workflow.ticket.readOnlyIt);
    expect(html).not.toContain(ar.workflow.ticket.waitingForItTeamClaim);
  });
  it("does not describe a legacy IT ticket as waiting in the new shared queue", () => {
    const html = renderBanner(APP_ROLE.IT_MANAGER, { ...waitingTicket, workflowModel: "legacy", status: "under_inspection" });
    expect(html).toContain(ar.workflow.ticket.readOnlyIt);
    expect(html).not.toContain(ar.workflow.ticket.waitingForItTeamClaim);
  });
  it.each([APP_ROLE.OWNER, APP_ROLE.ADMIN])("keeps %s out of the read-only banner", role => {
    expect(renderBanner(role)).toBe("");
  });
  it("does not show a read-only warning to the assigned IT executor", () => {
    expect(renderBanner(APP_ROLE.IT_MEMBER, { ...waitingTicket, assignedToId: 101 })).toBe("");
  });
  it.each([ar, en, ur])("keeps the existing Construction warning unchanged", translation => {
    const construction = { ...waitingTicket, maintenanceResponsibleDepartment: DEPT.CONSTRUCTION, maintenanceResponsibleManagerId: 300 };
    const expectedText = renderToStaticMarkup(<>{translation.workflow.ticket.readOnlyConstruction}</>);
    expect(renderBanner(APP_ROLE.GENERAL_MAINTENANCE_MANAGER, construction, translation)).toContain(expectedText);
  });
  it("keeps the existing out-of-department warning for a Construction Manager viewing general maintenance", () => {
    expect(renderBanner(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, { ...waitingTicket, maintenanceResponsibleDepartment: DEPT.GENERAL }))
      .toContain(ar.workflow.ticket.readOnlyOutOfDepartment);
  });
});

describe("Existing server permission checks remain independent of message text", () => {
  it.each([APP_ROLE.IT_MANAGER, APP_ROLE.IT_MEMBER])("keeps unassigned %s read-only before claim", role => {
    expect(isTicketReadOnlyForUser({ id: 101, role }, waitingTicket)).toBe(true);
  });
  it("allows the assigned executor and keeps another team member read-only", () => {
    const claimed = { ...waitingTicket, assignedToId: 101 };
    expect(isTicketReadOnlyForUser({ id: 101, role: APP_ROLE.IT_MEMBER }, claimed)).toBe(false);
    expect(isTicketReadOnlyForUser({ id: 102, role: APP_ROLE.IT_MEMBER }, claimed)).toBe(true);
  });
  it.each([APP_ROLE.OWNER, APP_ROLE.ADMIN])("retains the %s override", role => {
    expect(isTicketReadOnlyForUser({ id: 101, role }, waitingTicket)).toBe(false);
  });
});
