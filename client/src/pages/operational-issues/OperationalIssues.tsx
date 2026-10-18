import { useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TechnicianCombobox } from "@/components/tickets/TechnicianCombobox";
import { CatalogPickerDialog } from "@/components/catalog/CatalogPickerDialog";
import { canCreateOperationalIssue, canReadOperationalIssue } from "@shared/operational-issues";
import { operationalIssueText } from "@/i18n/operationalIssues";
import { getLocalizedCatalogName, getLocalizedCatalogUnitName } from "@/i18n/catalogMasterData";
import { OperationalIssueQueue } from "./OperationalIssueQueue";
import { toast } from "sonner";

export default function OperationalIssues() {
  const { user } = useAuth(); const { language, dir } = useTranslation(); const text = operationalIssueText[language];
  const allowed = user?.isActive === 1 && canReadOperationalIssue(user.role);
  const status = trpc.operationalIssues.status.useQuery(undefined, { enabled: allowed, retry: false });
  if (!allowed) return <p role="alert">{text.forbidden}</p>;
  return <div className="p-6 space-y-5" dir={dir}><h1 className="text-2xl font-bold">{text.title}</h1>
    {status.error ? <p role="alert">{status.error.message}</p> : status.isLoading ? <p>{text.load}</p> : status.data?.enabled ? <>
      {canCreateOperationalIssue(user.role) && <OperationalIssueForm />}
      <OperationalIssueQueue />
    </> : <p>{text.disabled}</p>}
  </div>;
}
function OperationalIssueForm() {
  const { language } = useTranslation(); const text = operationalIssueText[language]; const utils = trpc.useUtils();
  const [siteId, setSiteId] = useState(""); const [sectionId, setSectionId] = useState(""); const [collectorId, setCollectorId] = useState(""); const [reason, setReason] = useState("");
  const [items, setItems] = useState<Array<{ catalogItemId: number; name: string; unit: string; quantity: number }>>([]); const [picker, setPicker] = useState(false);
  const key = useRef<{ value: string; key: string } | null>(null);
  const sites = trpc.sites.list.useQuery();
  const sections = trpc.sections.list.useQuery({ siteId: Number(siteId) }, { enabled: Boolean(siteId) });
  const choices = trpc.operationalIssues.choices.useQuery(); const units = trpc.catalog.units.list.useQuery();
  const issueUnits = trpc.operationalIssues.itemUnits.useQuery({ catalogItemIds: items.map(item => item.catalogItemId) }, { enabled: items.length > 0, retry: false });
  const unitFor = (id: number) => issueUnits.data?.find(item => item.catalogItemId === id)?.unit;
  const create = trpc.operationalIssues.create.useMutation();
  const valid = siteId && sectionId && collectorId && reason.trim() && !issueUnits.error && items.length > 0 && items.every(i => Number.isInteger(i.quantity) && i.quantity >= 1 && !!unitFor(i.catalogItemId));
  return <Card><CardHeader><CardTitle>{text.newOrder}</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div><Label>{text.site} *</Label><select className="w-full h-9 rounded-md border bg-background px-2" value={siteId} onChange={e => { setSiteId(e.target.value); setSectionId(""); }}><option value="">—</option>{(sites.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><Label>{text.section} *</Label><select className="w-full h-9 rounded-md border bg-background px-2" disabled={!siteId} value={sectionId} onChange={e => setSectionId(e.target.value)}><option value="">—</option>{(sections.data || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><Label>{text.collector} *</Label><TechnicianCombobox options={(choices.data?.collectors || []).map(u => ({ value: String(u.id), label: u.name }))} value={collectorId} onValueChange={setCollectorId} /></div>
    </div>
    <div><Label>{text.reason} *</Label><Textarea value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /></div>
    <Button variant="outline" onClick={() => setPicker(true)} disabled={items.length >= 20}>{text.catalog}</Button>
    {items.map((item, index) => <div key={item.catalogItemId} className="rounded-lg border p-3 flex flex-wrap items-center gap-3">
      <p className="flex-1 min-w-40">{item.name}</p><div><Label>{text.quantity}</Label><Input className="w-28" type="number" min={1} step="1" value={item.quantity} onChange={e => setItems(old => old.map((row, n) => n === index ? { ...row, quantity: Number(e.target.value) } : row))} /></div>
      <span>{getLocalizedCatalogUnitName(unitFor(item.catalogItemId) || item.unit, units.data || [], language)}</span><Button variant="ghost" onClick={() => setItems(old => old.filter((_, n) => n !== index))}>{text.remove}</Button>
    </div>)}
    {issueUnits.error && <p role="alert" className="text-destructive">{issueUnits.error.message}</p>}
    <Button disabled={!valid || create.isPending} onClick={async () => {
      if (!valid || create.isPending) return;
      const body = { siteId: Number(siteId), sectionId: Number(sectionId), collectorId: Number(collectorId), reason: reason.trim(), items: items.map(({ catalogItemId, quantity }) => ({ catalogItemId, quantity, unit: unitFor(catalogItemId)! })) };
      const value = JSON.stringify(body); if (!key.current || key.current.value !== value) key.current = { value, key: crypto.randomUUID() };
      try { await create.mutateAsync({ ...body, operationKey: key.current.key }); toast.success(text.saved); setItems([]); setReason(""); key.current = null; await utils.operationalIssues.list.invalidate(); }
      catch (error) { toast.error(error instanceof Error ? error.message : text.error); }
    }}>{text.save}</Button>
    <CatalogPickerDialog open={picker} onClose={() => setPicker(false)} onSelect={item => {
      if (!items.some(i => i.catalogItemId === item.id)) setItems(old => [...old, { catalogItemId: item.id, name: getLocalizedCatalogName(item, language), unit: item.unit || "", quantity: 1 }]);
    }} />
  </CardContent></Card>;
}
