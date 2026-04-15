import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Edit, Trash2, Package, AlertTriangle,
  CheckCircle, Wrench, XCircle, ShieldCheck, ShieldOff,
} from "lucide-react";
import DropZone from "@/components/DropZone";

type AssetStatus = "active" | "inactive" | "under_maintenance" | "disposed";

interface AssetFormData {
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  siteId: string;
  locationDetail: string;
  status: AssetStatus;
  purchaseDate: string;
  purchaseCost: string;
  warrantyExpiry: string;
  warrantyNotes: string;
  photoUrl: string;
  notes: string;
}

const defaultForm: AssetFormData = {
  name: "", description: "", category: "", brand: "", model: "",
  serialNumber: "", siteId: "", locationDetail: "", status: "active",
  purchaseDate: "", purchaseCost: "", warrantyExpiry: "", warrantyNotes: "",
  photoUrl: "", notes: "",
};

export default function Assets() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetFormData>(defaultForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const utils = trpc.useUtils();

  const { data: assets = [], isLoading } = trpc.assets.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const { data: sites = [] } = trpc.sites.list.useQuery();

  const createMut = trpc.assets.create.useMutation({
    onSuccess: () => {
      toast.success(t.assets.assetCreated);
      utils.assets.list.invalidate();
      setShowForm(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.assets.update.useMutation({
    onSuccess: () => {
      toast.success(t.assets.assetUpdated);
      utils.assets.list.invalidate();
      setShowForm(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.assets.delete.useMutation({
    onSuccess: () => {
      toast.success(t.assets.assetDeleted);
      utils.assets.list.invalidate();
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      brand: form.brand || undefined,
      model: form.model || undefined,
      serialNumber: form.serialNumber || undefined,
      siteId: form.siteId ? Number(form.siteId) : undefined,
      locationDetail: form.locationDetail || undefined,
      status: form.status,
      purchaseDate: form.purchaseDate || undefined,
      purchaseCost: form.purchaseCost || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
      warrantyNotes: form.warrantyNotes || undefined,
      photoUrl: form.photoUrl || undefined,
      notes: form.notes || undefined,
    };
    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const openEdit = (asset: any) => {
    setEditId(asset.id);
    setForm({
      name: asset.name ?? "",
      description: asset.description ?? "",
      category: asset.category ?? "",
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serialNumber: asset.serialNumber ?? "",
      siteId: asset.siteId ? String(asset.siteId) : "",
      locationDetail: asset.locationDetail ?? "",
      status: asset.status ?? "active",
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split("T")[0] : "",
      purchaseCost: asset.purchaseCost ?? "",
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split("T")[0] : "",
      warrantyNotes: asset.warrantyNotes ?? "",
      photoUrl: asset.photoUrl ?? "",
      // ensure string
      notes: asset.notes ?? "",
    });
    setShowForm(true);
  };

  const statusConfig: Record<AssetStatus, { label: string; color: string; icon: any }> = {
    active: { label: t.assets.active, color: "bg-green-100 text-green-800", icon: CheckCircle },
    inactive: { label: t.assets.inactive, color: "bg-gray-100 text-gray-800", icon: XCircle },
    under_maintenance: { label: t.assets.under_maintenance, color: "bg-yellow-100 text-yellow-800", icon: Wrench },
    disposed: { label: t.assets.disposed, color: "bg-red-100 text-red-800", icon: Trash2 },
  };

  // Stats
  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter((a: any) => a.status === "active").length,
    underMaintenance: assets.filter((a: any) => a.status === "under_maintenance").length,
    warrantyExpiringSoon: assets.filter((a: any) => {
      if (!a.warrantyExpiry) return false;
      const days = (new Date(a.warrantyExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 30;
    }).length,
  }), [assets]);

  const isWarrantyExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.assets.title}</h1>
          <p className="text-muted-foreground text-sm">{t.assets.description}</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(defaultForm); setShowForm(true); }}>
          <Plus className="h-4 w-4 ml-2" />
          {t.assets.addAsset}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t.assets.totalAssets}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t.assets.activeAssets}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wrench className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.underMaintenance}</p>
              <p className="text-xs text-muted-foreground">{t.assets.underMaintenance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.warrantyExpiringSoon}</p>
              <p className="text-xs text-muted-foreground">{t.assets.warrantyExpiringSoon}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            <SelectItem value="active">{t.assets.active}</SelectItem>
            <SelectItem value="inactive">{t.assets.inactive}</SelectItem>
            <SelectItem value="under_maintenance">{t.assets.under_maintenance}</SelectItem>
            <SelectItem value="disposed">{t.assets.disposed}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-40 bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t.assets.noAssets}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset: any) => {
            const cfg = statusConfig[asset.status as AssetStatus] ?? statusConfig.active;
            const StatusIcon = cfg.icon;
            const wExpired = isWarrantyExpired(asset.warrantyExpiry);
            return (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{asset.assetNumber}</p>
                      <CardTitle className="text-base truncate">{asset.name}</CardTitle>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {asset.category && (
                    <p className="text-sm text-muted-foreground">{asset.category}</p>
                  )}
                  {(asset.brand || asset.model) && (
                    <p className="text-sm">{[asset.brand, asset.model].filter(Boolean).join(" · ")}</p>
                  )}
                  {asset.serialNumber && (
                    <p className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</p>
                  )}
                  {asset.warrantyExpiry && (
                    <div className={`flex items-center gap-1 text-xs ${wExpired ? "text-red-600" : "text-green-600"}`}>
                      {wExpired ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {wExpired ? t.assets.warrantyExpired : t.assets.warrantyActive}
                      {" · "}{new Date(asset.warrantyExpiry).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(asset)}>
                      <Edit className="h-3 w-3 ml-1" />
                      {t.common.edit}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(asset.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t.assets.editAsset : t.assets.addAsset}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t.assets.assetName} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.category}</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.status}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as AssetStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.assets.active}</SelectItem>
                  <SelectItem value="inactive">{t.assets.inactive}</SelectItem>
                  <SelectItem value="under_maintenance">{t.assets.under_maintenance}</SelectItem>
                  <SelectItem value="disposed">{t.assets.disposed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.assets.brand}</Label>
              <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.model}</Label>
              <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.serialNumber}</Label>
              <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.location}</Label>
              <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.common.none}</SelectItem>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.assets.locationDetail}</Label>
              <Input value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.purchaseDate}</Label>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.purchaseCost}</Label>
              <Input type="number" value={form.purchaseCost} onChange={e => setForm(f => ({ ...f, purchaseCost: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.warrantyExpiry}</Label>
              <Input type="date" value={form.warrantyExpiry} onChange={e => setForm(f => ({ ...f, warrantyExpiry: e.target.value }))} />
            </div>
            <div>
              <Label>{t.assets.warrantyNotes}</Label>
              <Input value={form.warrantyNotes} onChange={e => setForm(f => ({ ...f, warrantyNotes: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>{t.common.description}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>{t.common.notes}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {/* Photo Upload via DropZone */}
            <div className="col-span-2">
              <Label>{t.assets.uploadPhoto}</Label>
              {form.photoUrl ? (
                <div className="flex items-center gap-3 mt-1">
                  <img src={form.photoUrl} alt="asset" className="h-16 w-16 object-cover rounded border" />
                  <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, photoUrl: "" }))}>
                    {t.common.delete}
                  </Button>
                </div>
              ) : (
                <DropZone
                  onFilesUploaded={(files) => {
                    if (files[0]) setForm(f => ({ ...f, photoUrl: files[0].url ?? "" }));
                  }}
                  accept="image/*"
                  maxFiles={1}
                  className="mt-1"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(defaultForm); }}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name || createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.assets.deleteAsset}</DialogTitle>
          </DialogHeader>
          <p>{t.assets.confirmDelete}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
