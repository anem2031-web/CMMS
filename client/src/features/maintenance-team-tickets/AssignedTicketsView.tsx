import React from "react";
import type { AssignedTeamTicket } from "../../../../shared/maintenance-team-tickets/assignment";

export function AssignedTicketsView({
  tickets,
  language,
  renderExecution,
  audience = "team",
  focusTicketId,
}: {
  tickets: AssignedTeamTicket[];
  language: string;
  renderExecution?: (ticket: AssignedTeamTicket) => React.ReactNode;
  audience?: "team" | "warehouse";
  focusTicketId?: number;
}) {
  const [opened, setOpened] = React.useState<number[]>(() =>
    tickets.filter(t => t.ticketId === focusTicketId).map(t => t.assignmentId)
  );
  const ar = language === "ar",
    ur = language === "ur";
  const title = ar
    ? "تذاكر الصيانة"
    : ur
      ? "مرمت کے ٹکٹ"
      : "Maintenance Tickets";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {audience === "warehouse"
          ? ar
            ? "طلبات مواد تذاكر الصيانة والتوفير والاستلام والمرتجع، مرتبطة برقم التذكرة."
            : ur
              ? "مرمت کے ٹکٹ کے مواد کی درخواستیں، فراہمی، وصولی اور واپسی۔"
              : "Maintenance ticket material requests, supply, receipt and returns, linked to the ticket number."
          : renderExecution
            ? ar
              ? "تذاكر فريق الصيانة وإجراءاتها والمواد ومراجعة المسؤول."
              : ur
                ? "مرمت کی ٹیم کے ٹکٹ، کارروائیاں، مواد اور ذمہ دار کا جائزہ۔"
                : "Maintenance team tickets, actions, materials and manager review."
            : ar
              ? "التذاكر المسندة حسب فريق الصيانة. عرض الإسناد فقط في هذه المرحلة؛ إجراءات التنفيذ ستُفعّل في المرحلة التالية."
              : ur
                ? "مرمت کی ٹیم کے تفویض کردہ ٹکٹ۔ اس مرحلے میں صرف تفویض دکھائی جاتی ہے؛ عمل کے اقدامات اگلے مرحلے میں فعال ہوں گے۔"
                : "Tickets assigned by maintenance team. Assignment view only at this stage; execution actions will be enabled in the next stage."}
      </p>
      {!tickets.length && (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          {audience === "warehouse"
            ? ar
              ? "لا توجد طلبات مواد لتذاكر الصيانة."
              : ur
                ? "مرمت کے ٹکٹ کے مواد کی کوئی درخواست نہیں ہے۔"
                : "No maintenance ticket material requests."
            : ar
              ? "لا توجد تذاكر مسندة إلى فريقك."
              : ur
                ? "آپ کی ٹیم کو کوئی ٹکٹ تفویض نہیں ہوا۔"
                : "No team tickets assigned."}
        </p>
      )}
      {tickets.map(ticket => (
        <details
          key={ticket.assignmentId}
          open={
            focusTicketId != null
              ? opened.includes(ticket.assignmentId)
              : undefined
          }
          onToggle={e => {
            const open = e.currentTarget.open;
            setOpened(ids =>
              open
                ? ids.includes(ticket.assignmentId)
                  ? ids
                  : [...ids, ticket.assignmentId]
                : ids.filter(id => id !== ticket.assignmentId)
            );
          }}
          className="rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          <summary className="cursor-pointer p-4">
            <span className="font-semibold" dir="auto">
              {ticket.ticketNumber} — {ticket.title}
            </span>
            <span className="ms-3 text-sm text-muted-foreground">
              {ticket.teamName}
            </span>
          </summary>
          <div className="space-y-2 border-t p-4 text-sm">
            <p>
              {ticket.siteName} / {ticket.sectionName}
            </p>
            <p>
              {ar ? "المستودع" : ur ? "گودام" : "Warehouse"}:{" "}
              {ticket.warehouseName}
            </p>
            <p>
              {ar ? "الحالة" : ur ? "حالت" : "Status"}:{" "}
              {ticket.stage === "action_required"
                ? ar
                  ? "بانتظار إجراء الفريق"
                  : ur
                    ? "ٹیم کے اقدام کا انتظار"
                    : "Awaiting team action"
                : ticket.stage}
            </p>
            <p className="whitespace-pre-wrap" dir="auto">
              {ticket.description}
            </p>
            {renderExecution &&
              opened.includes(ticket.assignmentId) &&
              renderExecution(ticket)}
          </div>
        </details>
      ))}
    </div>
  );
}
