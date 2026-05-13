import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";

export default function ItemsManager() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    itemCode: "",
    nameAr: "",
    nameEn: "",
    nameUr: "",
    unit: "",
    manufacturer: "",
  });

  // Fetch items
  const { data: items, isLoading, refetch } = trpc.catalog.items.list.useQuery(
    {
      limit: 50,
    }
  );

  // Create item mutation
  const createItemMutation = trpc.catalog.items.create.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({
        itemCode: "",
        nameAr: "",
        nameEn: "",
        nameUr: "",
        unit: "",
        manufacturer: "",
      });
      setIsDialogOpen(false);
    },
  });

  // Delete item mutation
  const deleteItemMutation = trpc.catalog.items.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateItem = async () => {
    if (!formData.itemCode || !formData.nameAr || !formData.nameEn || !formData.nameUr) {
      alert(t("catalog.validation.requiredFields", "الحقول المطلوبة: الكود والاسم"));
      return;
    }

    await createItemMutation.mutateAsync({
      code: formData.itemCode,
      nameAr: formData.nameAr,
      nameEn: formData.nameEn,
      nameUr: formData.nameUr,
      nodeId: 1,
    });
  };

  const handleDeleteItem = async (itemId: number) => {
    if (confirm(t("catalog.confirm.deleteItem", "هل تريد حذف هذا الصنف؟"))) {
      await deleteItemMutation.mutateAsync(itemId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">
          {t("catalog.items.title", "إدارة الأصناف")}
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("catalog.items.addNew", "إضافة صنف جديد")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t("catalog.items.addNew", "إضافة صنف جديد")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    {t("catalog.fields.itemCode", "كود الصنف")} *
                  </label>
                  <Input
                    value={formData.itemCode}
                    onChange={(e) =>
                      setFormData({ ...formData, itemCode: e.target.value })
                    }
                    placeholder="مثال: PNT-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("catalog.fields.manufacturer", "الصانع")}
                  </label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder="مثال: LG"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  {t("catalog.fields.nameAr", "الاسم بالعربية")} *
                </label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) =>
                    setFormData({ ...formData, nameAr: e.target.value })
                  }
                  placeholder="مثال: دهان أبيض"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {t("catalog.fields.nameEn", "الاسم بالإنجليزية")} *
                </label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) =>
                    setFormData({ ...formData, nameEn: e.target.value })
                  }
                  placeholder="Example: White Paint"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {t("catalog.fields.nameUr", "الاسم بالأردية")} *
                </label>
                <Input
                  value={formData.nameUr}
                  onChange={(e) =>
                    setFormData({ ...formData, nameUr: e.target.value })
                  }
                  placeholder="مثال: سفید رنگ"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {t("catalog.fields.unit", "الوحدة")}
                </label>
                <Input
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="مثال: لتر"
                />
              </div>

              <Button
                onClick={handleCreateItem}
                disabled={createItemMutation.isPending}
                className="w-full"
              >
                {createItemMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("common.saving", "جاري الحفظ...")}
                  </>
                ) : (
                  t("common.save", "حفظ")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items Grid */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item: any) => (
              <ItemCard
                key={item.id}
                item={item}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">
                {t("catalog.items.empty", "لا توجد أصناف حتى الآن")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ITEM CARD COMPONENT
// ============================================================
interface ItemCardProps {
  item: any;
  onDelete: (itemId: number) => void;
}

function ItemCard({ item, onDelete }: ItemCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        {/* Image Placeholder */}
        <div className="mb-4 w-full h-32 bg-slate-100 rounded flex items-center justify-center">
          {item.primaryImageUrl ? (
            <img
              src={item.primaryImageUrl}
              alt={item.nameAr}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-400" />
          )}
        </div>

        {/* Item Details */}
        <div className="space-y-2">
          <div>
            <p className="font-semibold text-slate-900">{item.nameAr}</p>
            <p className="text-sm text-slate-600">{item.nameEn}</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
              {item.code}
            </span>
            {item.unit && (
              <span className="text-xs text-slate-600">{item.unit}</span>
            )}
          </div>

          {item.manufacturer && (
            <p className="text-xs text-slate-500">
              {t("catalog.fields.manufacturer", "الصانع")}: {item.manufacturer}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t("common.delete", "حذف")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
