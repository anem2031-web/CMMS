import { lazy, Suspense, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const TicketDetail = lazy(() => import("@/pages/tickets/TicketDetail"));

/** Preserve name-assigned ticket workflow within the single technician page. */
export function NamedTechnicianTickets() {
  const { t, language, dir } = useTranslation();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const query = trpc.tickets.listPaginated.useQuery(
    { page, pageSize: 20, groupSubTickets: false },
    { retry: false }
  );
  const l = (a: string, e: string, u: string) =>
    language === "ar" ? a : language === "ur" ? u : e;
  const close = () => {
    setSelected(null);
    void query.refetch();
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {l(
              "التذاكر المسندة بالاسم",
              "Name-assigned tickets",
              "نام کے مطابق تفویض کردہ ٹکٹ"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {query.isLoading && <p>{t.common.loading}</p>}
          {query.error && (
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
          )}
          {query.data?.tickets.map((ticket: { id: number; ticketNumber: string; title: string }) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelected(ticket.id)}
              className="block w-full rounded-xl border p-4 text-start hover:bg-muted/50"
            >
              <span className="font-mono" dir="ltr">
                {ticket.ticketNumber}
              </span>
              <p className="mt-1 font-medium">{ticket.title}</p>
              <span className="text-xs text-primary">
                {l(
                  "فتح التنفيذ الحالي",
                  "Open existing execution",
                  "موجودہ کارروائی کھولیں"
                )}
              </span>
            </button>
          ))}
          {query.data && !query.data.tickets.length && (
            <p>
              {l(
                "لا توجد تذاكر مسندة بالاسم.",
                "No name-assigned tickets.",
                "نام کے مطابق کوئی ٹکٹ نہیں۔"
              )}
            </p>
          )}
          {query.data && query.data.totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage(value => value - 1)}
              >
                {l("السابق", "Previous", "پچھلا")}
              </Button>
              <span>
                {page} / {query.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= query.data.totalPages || query.isFetching}
                onClick={() => setPage(value => value + 1)}
              >
                {l("التالي", "Next", "اگلا")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={selected != null}
        onOpenChange={open => {
          if (!open) close();
        }}
      >
        <DialogContent
          dir={dir}
          className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        >
          <DialogHeader>
            <DialogTitle>{t.nav.maintenanceTeamTickets}</DialogTitle>
          </DialogHeader>
          {selected != null && (
            <Suspense fallback={<p>{t.common.loading}</p>}>
              <TicketDetail embeddedTicketId={selected} onBack={close} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
