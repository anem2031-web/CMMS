import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { MaterialIdentityDialog } from "@/components/catalog/MaterialIdentityDialog";
import type { Assignment, MaterialNeed } from "@shared/maintenance-team-tickets/model";

/** Ticket-only controller; PMV2 and tickets share presentation, not their request identities. */
export function TicketMaterialIdentityResolver({ assignment, need, language, busy, error, onClose, onConfirm }: {
  assignment: Assignment; need: MaterialNeed; language: string; busy: boolean; error?: string;
  onClose: () => void; onConfirm: (catalogItemId: number, note: string) => Promise<boolean>;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const candidates = trpc.ticketTeamExecution.searchMaterialIdentityCandidates.useQuery(
    { assignmentId: assignment.id, needId: need.id, search },
    { retry: false, refetchOnWindowFocus: false }
  );
  return <MaterialIdentityDialog
    allowDifferentUnits
    open onClose={() => { if (!busy) onClose(); }} language={language}
    originalName={need.originalName || need.name} requestedQuantity={need.requested} unit={need.unit}
    referenceLabel={language === "ar" ? "التذكرة" : language === "ur" ? "ٹکٹ" : "Ticket"}
    referenceNumber={assignment.ticketNumber} itemTitle={assignment.title}
    search={search} onSearch={value => { setSearch(value); setSelectedId(null); }}
    items={candidates.data?.items ?? []} selectedId={selectedId} onSelect={setSelectedId}
    loading={candidates.isFetching} error={candidates.error ?? (error ? { message: error } : undefined)} busy={busy}
    onConfirm={() => {
      if (!selectedId || busy) return;
      const item = candidates.data?.items.find(item => item.id === selectedId);
      if (!item) return;
      const note = `مطابقة وصف الفني «${need.originalName || need.name}» بالصنف «${item.nameAr || item.nameEn || item.id}» من دليل المواد`;
      void onConfirm(selectedId, note).then(saved => { if (saved) onClose(); });
    }}
  />;
}
