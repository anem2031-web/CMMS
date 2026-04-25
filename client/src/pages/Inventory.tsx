import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, Plus, AlertTriangle, Loader2, Truck, CheckCircle2,
  Building2, ClipboardList, Pencil, Trash2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExportButton } from "@/components/ExportButton";
import { useLocation } from "wouter";
import { useTranslation, useLanguage } from "@/contexts/LanguageContext";

export default function Inventory() {
  const { t: tr } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = language === "en" ? "SAR" : "ر.س";

  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery();
  const { data: allPOs } = trpc.purchaseOrders.list.useQuery();
  const createMut = trpc.inventory.create.useMutation({
    onSuccess: () => { toast.success(t.common.save); refetch(); setOpen(false); },
    onError: (err) => toast.error(err.message),
  });

  const receiveItemMut = trpc.purchaseOrders.confirmDeliveryToWarehouse.useMutation({
    onSuccess: () => { toast.success(t.inventory.receive); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const utils = trpc.useUtils();
  const updateMut = trpc.inventory.update.useMutation({
    onSuccess: () => { toast.success(t.common.savedSuccessfully); utils.inventory.list.invalidate(); setEditOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMut = trpc.inventory.delete.useMutation({
    onSuccess: () => { toast.success(t.common.deletedSuccessfully); utils.inventory.list.invalidate(); setDeleteOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("pending_receive");
  const [form, setForm] = useState({ itemName: "", description: "", quantity: 0, unit: language === "en" ? "piece" : "قطعة", minQuantity: 0, location: "" });
  const [editForm, setEditForm] = useState({ itemName: "", description: "", quantity: 0, unit: "", minQuantity: 0, location: "" });
  const [receiveData, setReceiveData] = useState<Record<number, { cost: string; supplier: string; supplierItemName: string; warehousePhotoUrl: string }>>({}); 

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setEditForm({ itemName: item.itemName, description: item.description || "", quantity: item.quantity, unit: item.unit || "", minQuantity: item.minQuantity || 0, location: item.location || "" });
    setEditOpen(true);
  };
  const openDelete = (item: any) => { setSelectedItem(item); setDeleteOpen(true); };

  const isWarehouse = user?.role === "warehouse" || user?.role === "admin" || user?.role === "owner";

  const pendingReceiveItems = (allPOs || []).flatMap((po: any) =>
    (po.items || [])
      .filter((item: any) => item.status === "purchased")
      .map((item: any) => ({ ...item, poNumber: po.poNumber, poId: po.id, ticketId: po.ticketId }))
  );

  const recentlyReceived = (allPOs || []).flatMap((po: any) =>
    (po.items || [])
      .filter((item: any) => item.status === "received")
      .map((item: any) => ({ ...item, poNumber: po.poNumber, poId: po.id }))
  ).sort((a: any, b: any) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime())
  .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> {t.inventory.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t.common.description}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton endpoint="inventory" filename="inventory" />
          {isWarehouse && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> {t.common.add}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t.common.add} - {t.inventory.itemName}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>{t.inventory.itemName} *</Label><Input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} /></div>
                <div className="space-y-2"><Label>{t.common.description}</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2"><Label>{t.inventory.currentStock}</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></div>
                  <div className="space-y-2"><Label>{t.inventory.unit}</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>{t.inventory.minStock}</Label><Input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: parseInt(e.target.value) || 0 }))} /></div>
                </div>
                <div className="space-y-2"><Label>{t.inventory.location}</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                <Button onClick={() => { if (!form.itemName) { toast.error(t.inventory.itemName); return; } createMut.mutate(form); }} disabled={createMut.isPending} className="w-full gap-2">
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t.common.add}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab("pending_receive")}>
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold text-orange-800">{pendingReceiveItems.length}</p>
            <p className="text-[10px] text-orange-600">{t.inventory.waitingReceive}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab("received")}>
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-800">{recentlyReceived.length}</p>
            <p className="text-[10px] text-green-600">{t.inventory.receive}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50 cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab("stock")}>
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-800">{items?.length || 0}</p>
            <p className="text-[10px] text-blue-600">{t.inventory.currentStock}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-all" onClick={() => setActiveTab("stock")}>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-800">{items?.filter((i: any) => (i.minQuantity || 0) > 0 && i.quantity <= (i.minQuantity || 0)).length || 0}</p>
            <p className="text-[10px] text-red-600">{t.inventory.lowStock}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending_receive" className="text-xs gap-1">
            <Truck className="w-3 h-3" /> {t.inventory.waitingReceive}
            {pendingReceiveItems.length > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{pendingReceiveItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="received" className="text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" /> {t.inventory.receive}
          </TabsTrigger>
          <TabsTrigger value="stock" className="text-xs gap-1">
            <Package className="w-3 h-3" /> {t.inventory.currentStock}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending_receive" className="space-y-3 mt-4">
          {pendingReceiveItems.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <Truck className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t.common.noData}</p>
            </CardContent></Card>
          ) : (
            <>
              {isWarehouse && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2 text-xs text-orange-800">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>{t.inventory.waitingReceive}</span>
                </div>
              )}
              {pendingReceiveItems.map((item: any) => (
                <Card key={item.id} className="border-r-4 border-r-orange-400 hover:shadow-md transition-all">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{item.itemName}</h3>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] gap-1">
                        <Truck className="w-3 h-3" /> {t.inventory.waitingReceive}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <span className="text-muted-foreground block">{t.purchaseOrders.quantity}</span>
                        <span className="font-bold">{item.quantity} {item.unit || (language === "en" ? "piece" : "قطعة")}</span>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <span className="text-muted-foreground block">{t.purchaseOrders.poNumber}</span>
                        <Button variant="link" className="h-auto p-0 text-xs font-bold" onClick={() => setLocation(`/purchase-orders/${item.poId}`)}>
                          {item.poNumber}
                        </Button>
                      </div>
                      {item.estimatedUnitCost && (
                        <div className="bg-muted/50 rounded-lg p-2">
                          <span className="text-muted-foreground block">{t.purchaseOrders.estimatedUnitCost}</span>
                          <span className="font-bold">{parseFloat(item.estimatedUnitCost).toLocaleString(locale)} {currency}</span>
                        </div>
                      )}
                      {item.estimatedTotalCost && (
                        <div className="bg-muted/50 rounded-lg p-2">
                          <span className="text-muted-foreground block">{t.purchaseOrders.estimatedTotal}</span>
                          <span className="font-bold">{parseFloat(item.estimatedTotalCost).toLocaleString(locale)} {currency}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {item.invoicePhotoUrl && (
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground mb-1">{t.tickets.photos}</p>
                          <img src={item.invoicePhotoUrl} alt="invoice" className="w-full h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80" onClick={() => window.open(item.invoicePhotoUrl, "_blank")} />
                        </div>
                      )}
                      {item.purchasedPhotoUrl && (
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground mb-1">{t.tickets.photos}</p>
                          <img src={item.purchasedPhotoUrl} alt="item" className="w-full h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80" onClick={() => window.open(item.purchasedPhotoUrl, "_blank")} />
                        </div>
                      )}
                    </div>

                    {isWarehouse && (
                      <div className="bg-green-50/50 border border-green-200 rounded-lg p-3 space-y-3">
                        <p className="text-xs font-medium text-green-800 flex items-center gap-1">
                          <ClipboardList className="w-3.5 h-3.5" /> {t.inventory.receive}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-green-700">{t.inventory.actualCost} ({currency}) *</Label>
                            <Input
                              type="number"
                              placeholder={t.inventory.actualCost}
                              className="bg-white"
                              value={receiveData[item.id]?.cost || ""}
                              onChange={e => setReceiveData(p => ({ ...p, [item.id]: { ...p[item.id], cost: e.target.value, supplier: p[item.id]?.supplier || "", supplierItemName: p[item.id]?.supplierItemName || "", warehousePhotoUrl: p[item.id]?.warehousePhotoUrl || "" } }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-green-700">{t.inventory.supplierName} *</Label>
                            <Input
                              placeholder={t.inventory.supplierName}
                              className="bg-white"
                              value={receiveData[item.id]?.supplier || ""}
                              onChange={e => setReceiveData(p => ({ ...p, [item.id]: { ...p[item.id], cost: p[item.id]?.cost || "", supplier: e.target.value, supplierItemName: p[item.id]?.supplierItemName || "", warehousePhotoUrl: p[item.id]?.warehousePhotoUrl || "" } }))}
                            />
                          </div>
                        </div>
                        {receiveData[item.id]?.cost && (
                          <div className="text-xs text-green-700 bg-green-100 rounded-lg p-2">
                            {t.purchaseOrders.actualTotal}: <strong>{(parseFloat(receiveData[item.id]?.cost || "0") * item.quantity).toLocaleString(locale)} {currency}</strong>
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => {
                            const d = receiveData[item.id];
                            if (!d?.cost || !d?.supplier) { toast.error(t.inventory.actualCost + " & " + t.inventory.supplierName); return; }
                            if (!d?.supplierItemName) { toast.error("اسم الصنف كما في الفاتورة مطلوب"); return; }
                            if (!d?.warehousePhotoUrl) { toast.error("صورة الصنف مطلوبة"); return; }
                            receiveItemMut.mutate({ itemId: item.id, actualUnitCost: d.cost, supplierName: d.supplier, supplierItemName: d.supplierItemName, warehousePhotoUrl: d.warehousePhotoUrl });
                          }}
                          disabled={receiveItemMut.isPending}
                        >
                          {receiveItemMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {t.common.confirm}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-3 mt-4">
          {recentlyReceived.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{t.common.noData}</p>
            </CardContent></Card>
          ) : (
            recentlyReceived.map((item: any) => (
              <Card key={item.id} className="border-r-4 border-r-green-400">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{item.itemName}</h3>
                      <p className="text-xs text-muted-foreground">{item.poNumber}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">{t.inventory.receive}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <span className="text-muted-foreground block">{t.purchaseOrders.quantity}</span>
                      <span className="font-bold">{item.quantity} {item.unit || (language === "en" ? "piece" : "قطعة")}</span>
                    </div>
                    {item.actualUnitCost && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <span className="text-muted-foreground block">{t.inventory.actualCost}</span>
                        <span className="font-bold text-green-700">{parseFloat(item.actualUnitCost).toLocaleString(locale)} {currency}</span>
                      </div>
                    )}
                    {item.actualTotalCost && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <span className="text-muted-foreground block">{t.purchaseOrders.actualTotal}</span>
                        <span className="font-bold text-green-700">{parseFloat(item.actualTotalCost).toLocaleString(locale)} {currency}</span>
                      </div>
                    )}
                    {item.supplierName && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <span className="text-muted-foreground block">{t.inventory.supplierName}</span>
                        <span className="font-bold flex items-center gap-1"><Building2 className="w-3 h-3" />{item.supplierName}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}
            </div>
          ) : !items?.length ? (
            <Card><CardContent className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-lg mb-1">{t.common.noData}</h3>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(items as any[]).map((item: any) => {
                const isLow = (item.minQuantity || 0) > 0 && item.quantity <= (item.minQuantity || 0);
                return (
                  <Card key={item.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{item.itemName}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isLow && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" /> {t.inventory.lowStock}</Badge>}
                          {isWarehouse && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDelete(item)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground mb-2">{item.description}</p>}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t.purchaseOrders.quantity}:</span>
                        <span className={`font-bold ${isLow ? "text-destructive" : ""}`}>{item.quantity} {item.unit}</span>
                      </div>
                      {item.location && <div className="flex items-center justify-between text-xs text-muted-foreground mt-1"><span>{t.inventory.location}:</span><span>{item.location}</span></div>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {/* Edit Inventory Item Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.common.edit} - {selectedItem?.itemName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t.inventory.itemName} *</Label><Input value={editForm.itemName} onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))} /></div>
            <div className="space-y-2"><Label>{t.common.description}</Label><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>{t.inventory.currentStock}</Label><Input type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></div>
              <div className="space-y-2"><Label>{t.inventory.unit}</Label><Input value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
              <div className="space-y-2"><Label>{t.inventory.minStock}</Label><Input type="number" value={editForm.minQuantity} onChange={e => setEditForm(f => ({ ...f, minQuantity: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t.inventory.location}</Label><Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => { if (!editForm.itemName) { toast.error(t.inventory.itemName); return; } updateMut.mutate({ id: selectedItem.id, ...editForm }); }} disabled={updateMut.isPending}>
              {updateMut.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Inventory Item Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>{t.common.deleteWarning} <strong>{selectedItem?.itemName}</strong>? {t.common.cannotUndo}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate({ id: selectedItem.id })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
