import { trpc } from "@/lib/trpc";
/** Scoped API supplies the referenced document; never a new technician route. */
export function TicketSourceSummary({
  ticketId,
  language,
}: {
  ticketId: number;
  language: string;
}) {
  const query = trpc.tickets.getById.useQuery(
    { id: ticketId },
    { retry: false }
  );
  const l = (a: string, e: string, u: string) =>
    language === "ar" ? a : language === "ur" ? u : e;
  if (query.isLoading)
    return <p>{l("جارٍ التحميل…", "Loading…", "لوڈ ہو رہا ہے…")}</p>;
  if (query.error)
    return (
      <p role="alert" className="text-destructive">
        {query.error.message}
      </p>
    );
  if (!query.data)
    return (
      <p>{l("البلاغ غير متاح", "Ticket unavailable", "ٹکٹ دستیاب نہیں")}</p>
    );
  const ticket = query.data;
  return (
    <div className="space-y-3">
      <p className="font-mono" dir="ltr">
        {ticket.ticketNumber}
      </p>
      <h3 className="font-semibold">{ticket.title}</h3>
      <p className="whitespace-pre-wrap">{ticket.description}</p>
      <p>
        {l("الحالة", "Status", "حالت")}: {ticket.status}
      </p>
    </div>
  );
}
