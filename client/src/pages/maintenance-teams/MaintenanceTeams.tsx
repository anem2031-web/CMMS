import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { TeamsManagementView } from "@/features/maintenance-team-tickets/TeamsManagementView";
import { canManageTicketTeams } from "@shared/maintenance-team-tickets/team-management";
import { useState } from "react";

export default function MaintenanceTeams() {
  const { user, loading } = useAuth();
  const { language, dir, t } = useTranslation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = user?.isActive === 1 && canManageTicketTeams(user?.role);
  const list = trpc.maintenanceTeams.list.useQuery(undefined, {
    enabled: !!allowed,
    retry: false,
  });
  const create = trpc.maintenanceTeams.create.useMutation();
  const save = trpc.maintenanceTeams.save.useMutation();
  const active = trpc.maintenanceTeams.setActive.useMutation();
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await work();
      await list.refetch();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
      await list.refetch();
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (loading || (allowed && list.isLoading))
    return <div className="p-6">{t.common.loading}</div>;
  if (!allowed)
    return (
      <div role="alert" className="p-6">
        {language === "ar"
          ? "ليس لديك صلاحية لإدارة فرق تذاكر الصيانة"
          : language === "ur"
            ? "آپ کو ٹیموں کے انتظام کی اجازت نہیں ہے۔"
            : "You cannot manage maintenance ticket teams."}
      </div>
    );
  if (!list.data)
    return (
      <div role="alert" className="p-6">
        {list.error?.message ?? t.common.error}
        <button className="ms-3 underline" onClick={() => void list.refetch()}>
          {language === "ar"
            ? "إعادة المحاولة"
            : language === "ur"
              ? "دوبارہ کوشش"
              : "Retry"}
        </button>
      </div>
    );
  return (
    <div className="p-6 space-y-6" dir={dir}>
      {(error || list.error) && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {error || list.error?.message}
        </div>
      )}
      <TeamsManagementView
        data={list.data}
        language={language}
        busy={busy || create.isPending || save.isPending || active.isPending}
        onCreate={input => run(() => create.mutateAsync(input))}
        onSave={input => run(() => save.mutateAsync(input))}
        onActive={input => run(() => active.mutateAsync(input))}
      />
    </div>
  );
}
