import { useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { canProcessOperationalIssue, type OperationalLine, type OperationalDelivery } from "@shared/operational-issues";
import { operationalIssueText } from "@/i18n/operationalIssues";

export function OperationalIssueQueue({ process = false }: { process?: boolean }) {
  const { user } = useAuth(); const { language, dir } = useTranslation();
  const text = operationalIssueText[language];
  const list = trpc.operationalIssues.list.useQuery(undefined, { retry: false });
  const [id, setId] = useState<number | null>(null);
  const detail = trpc.operationalIssues.detail.useQuery({ id: id || 0 }, { enabled: Boolean(id && list.data?.enabled), retry: false });
  const approve = trpc.operationalIssues.approve.useMutation();
  const canProcess = process && canProcessOperationalIssue(user?.role);
  const refresh = async () => { await Promise.all([list.refetch(), ...(id ? [detail.refetch()] : [])]); };
  const run = async (work: () => Promise<unknown>) => {
    try { await work(); toast.success(text.success); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : text.error); await refresh(); }
  };
  if (list.isLoading) return <p>{text.load}</p>;
  if (list.error) return <p role="alert" className="text-destructive">{list.error.message}</p>;
  if (!list.data?.enabled) return <p>{text.disabled}</p>;
  return <div className="space-y-4" dir={dir}>
    <Button variant="outline" onClick={() => void refresh()}>{text.refresh}</Button>
    {!list.data.orders.length && <p className="text-muted-foreground">{text.empty}</p>}
    <div className="space-y-2">{list.data.orders.map(order => <Card key={order.id}>
      <CardContent className="py-3 flex flex-wrap justify-between items-center gap-3">
        <div><p className="font-semibold">{order.orderNumber}</p><p className="text-sm text-muted-foreground">{order.siteName} / {order.sectionName} · {text.collector}: {order.collectorName}</p></div>
        <div className="flex gap-2 items-center"><Badge variant="outline">{text[order.status]}</Badge><Button variant="outline" onClick={() => setId(order.id)}>{text.details}</Button></div>
      </CardContent>
    </Card>)}</div>
    {id && detail.isLoading && <p>{text.load}</p>}
    {detail.error && <p role="alert" className="text-destructive">{detail.error.message}</p>}
    {detail.data && <Card><CardHeader><CardTitle>{detail.data.order.orderNumber}</CardTitle></CardHeader><CardContent className="space-y-4">
      <p>{text.creator}: {detail.data.order.creatorName} · {text.collector}: {detail.data.order.collectorName}</p>
      <p>{text.reason}: {detail.data.order.reason}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
        <p>{text.totalCost}: {detail.data.cost.issued.toFixed(2)} {text.currency}</p><p>{text.returned}: {detail.data.cost.returned.toFixed(2)} {text.currency}</p><p className="font-semibold">{text.netCost}: {detail.data.cost.net.toFixed(2)} {text.currency}</p>
      </div>
      {canProcess && detail.data.order.status === "pending" && <Button disabled={approve.isPending} onClick={() => void run(() => approve.mutateAsync({ id: Number(id), revision: Number(detail.data!.order.revision) }))}>{text.approve}</Button>}
      {detail.data.items.map(line => <OperationalLinePanel key={line.id} line={line} approved={detail.data!.order.status === "approved"} canProcess={canProcess} orderId={Number(id)} refresh={refresh} />)}
      {detail.data.deliveries.map(delivery => <OperationalReturnPanel key={delivery.id} delivery={delivery} orderId={Number(id)} canProcess={canProcess} refresh={refresh} />)}
    </CardContent></Card>}
  </div>;
}

function OperationalLinePanel({ line, orderId, approved, canProcess, refresh }: { line: OperationalLine; orderId: number; approved: boolean; canProcess: boolean; refresh(): Promise<void> }) {
  const { language } = useTranslation(); const text = operationalIssueText[language];
  const remaining = Math.max(0, Number(line.quantity) - Number(line.issuedQuantity));
  const [warehouseId, setWarehouseId] = useState(""); const [token, setToken] = useState(""); const [quantity, setQuantity] = useState(remaining);
  const [lot, setLot] = useState<any>(null); const key = useRef<{ value: string; key: string } | null>(null);
  const warehouses = trpc.warehouse.list.useQuery(undefined, { enabled: canProcess && approved });
  const resolve = trpc.warehouseIssueBatches.resolveLot.useMutation();
  const issue = trpc.operationalIssues.issue.useMutation();
  const verify = async () => {
    setLot(null);
    try {
      const found = await resolve.mutateAsync({ warehouseId: Number(warehouseId), code: token });
      if (Number(found.linkedItemId) !== Number(line.catalogItemId)) throw new Error(text.mismatch);
      setLot(found);
    } catch (error) { toast.error(error instanceof Error ? error.message : text.error); }
  };
  const submit = async () => {
    if (!lot || issue.isPending) return;
    const fingerprint = JSON.stringify([orderId, line.id, warehouseId, lot.trackingToken, quantity]);
    if (!key.current || key.current.value !== fingerprint) key.current = { value: fingerprint, key: crypto.randomUUID() };
    try {
      await issue.mutateAsync({ orderId, itemId: line.id, warehouseId: Number(warehouseId), lotTrackingToken: lot.trackingToken, quantity, operationKey: key.current.key });
      toast.success(text.success); key.current = null; setLot(null); setToken(""); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : text.error); await refresh(); }
  };
  return <section className="rounded-lg border p-4 space-y-3">
    <p className="font-semibold">{line.itemName}</p><p className="text-sm text-muted-foreground">{text.requested}: {line.quantity} {line.unit} · {text.issued}: {line.issuedQuantity} {line.unit}</p>
    {canProcess && approved && remaining > 0 && <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><Label>{text.warehouse}</Label><select className="w-full h-9 rounded-md border bg-background px-2" value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setLot(null); }}><option value="">—</option>{(warehouses.data || []).filter(w => Number(w.isActive) === 1).map(w => <option key={w.id} value={w.id}>{language === "ar" ? w.nameAr : w.nameEn || w.nameAr}</option>)}</select></div>
        <div><Label>{text.token}</Label><Input value={token} onChange={e => { setToken(e.target.value); setLot(null); }} dir="ltr" /></div>
        <div><Label>{text.quantity}</Label><Input type="number" min={1} max={remaining} step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
      </div>
      <Button variant="outline" disabled={!warehouseId || !token.trim() || resolve.isPending || issue.isPending} onClick={() => void verify()}>{text.resolve}</Button>
      {lot && <div className="rounded-lg border bg-muted/30 p-3 space-y-2"><p>{lot.lotCode} · {text.available}: {lot.lotBalanceQuantity} {lot.unit}</p><p>{text.totalCost}: {(Number(lot.lotIssueUnitCost) * quantity).toFixed(2)} {text.currency}</p><Button disabled={issue.isPending || !(quantity > 0) || quantity > Math.min(remaining, Number(lot.lotBalanceQuantity))} onClick={() => void submit()}>{text.issue}</Button></div>}
    </>}
  </section>;
}
function OperationalReturnPanel({ delivery, orderId, canProcess, refresh }: { delivery: OperationalDelivery; orderId: number; canProcess: boolean; refresh(): Promise<void> }) {
  const { language } = useTranslation(); const text = operationalIssueText[language];
  const [quantity, setQuantity] = useState(1); const [reason, setReason] = useState("");
  const operation = useRef<{ value: string; key: string } | null>(null);
  const returned = trpc.operationalIssues.returnMaterial.useMutation();
  const remaining = Number(delivery.quantity) - Number(delivery.returnedQuantity);
  return <section className="rounded-lg border p-3 space-y-2 text-sm">
    <p className="font-medium">{text.delivery}: {delivery.deliveryNumber} · {delivery.lotCode}</p><p>{text.issued}: {delivery.quantity} · {text.returned}: {delivery.returnedQuantity}</p>
    {canProcess && remaining >= 1 && <div className="flex flex-wrap gap-2 items-end">
      <div><Label>{text.quantity}</Label><Input type="number" min={1} max={Math.floor(remaining)} step={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></div>
      <div className="flex-1"><Label>{text.returnReason}</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
      <Button variant="outline" disabled={returned.isPending || !reason.trim() || quantity < 1 || quantity > remaining || !Number.isInteger(quantity)} onClick={async () => {
        const body = { orderId, deliveryDocumentId: Number(delivery.deliveryDocumentId), quantity, reason };
        const value = JSON.stringify(body); if (!operation.current || operation.current.value !== value) operation.current = { value, key: crypto.randomUUID() };
        try { await returned.mutateAsync({ ...body, operationKey: operation.current.key }); toast.success(text.success); setReason(""); operation.current = null; await refresh(); }
        catch (error) { toast.error(error instanceof Error ? error.message : text.error); }
      }}>{text.returnAction}</Button>
    </div>}
  </section>;
}
