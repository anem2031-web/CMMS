import React, { useState, useCallback } from "react";
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
import { Plus, Edit2, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: number;
  nameAr: string;
  nameEn: string;
  nameUr: string;
  level: number;
  isActive: boolean;
  children?: TreeNode[];
}

export default function TaxonomyManager() {
  const { t } = useTranslation();
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nameAr: "",
    nameEn: "",
    nameUr: "",
  });

  // Fetch root taxonomy nodes
  const { data: nodes, isLoading, refetch } = trpc.catalog.nodes.list.useQuery(
    {
      parentId: undefined,
      isActive: true,
    }
  );

  // Fetch children for a node
  const { data: childrenData } = trpc.catalog.nodes.getChildren.useQuery(
    selectedNode?.id || 0,
    {
      enabled: !!selectedNode,
    }
  );

  // Create node mutation
  const createNodeMutation = trpc.catalog.nodes.create.useMutation({
    onSuccess: () => {
      refetch();
      setFormData({ nameAr: "", nameEn: "", nameUr: "" });
      setIsDialogOpen(false);
    },
  });

  // Delete node mutation
  const deleteNodeMutation = trpc.catalog.nodes.delete.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedNode(null);
    },
  });

  const toggleExpand = useCallback((nodeId: number) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleCreateNode = async () => {
    if (!formData.nameAr || !formData.nameEn || !formData.nameUr) {
      alert(t("catalog.validation.allFieldsRequired", "جميع الحقول مطلوبة"));
      return;
    }

    await createNodeMutation.mutateAsync({
      ...formData,
      parentId: selectedNode?.id,
      level: (selectedNode?.level || 0) + 1,
    });
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (confirm(t("catalog.confirm.deleteNode", "هل تريد حذف هذا التصنيف؟"))) {
      await deleteNodeMutation.mutateAsync(nodeId);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tree View */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("catalog.taxonomy.title", "هيكلية التصنيفات")}</span>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t("catalog.taxonomy.addRoot", "إضافة قسم")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t("catalog.taxonomy.addNew", "إضافة تصنيف جديد")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">
                        {t("catalog.fields.nameAr", "الاسم بالعربية")}
                      </label>
                      <Input
                        value={formData.nameAr}
                        onChange={(e) =>
                          setFormData({ ...formData, nameAr: e.target.value })
                        }
                        placeholder="مثال: الدهانات"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        {t("catalog.fields.nameEn", "الاسم بالإنجليزية")}
                      </label>
                      <Input
                        value={formData.nameEn}
                        onChange={(e) =>
                          setFormData({ ...formData, nameEn: e.target.value })
                        }
                        placeholder="Example: Paints"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        {t("catalog.fields.nameUr", "الاسم بالأردية")}
                      </label>
                      <Input
                        value={formData.nameUr}
                        onChange={(e) =>
                          setFormData({ ...formData, nameUr: e.target.value })
                        }
                        placeholder="مثال: رنگ"
                      />
                    </div>
                    <Button
                      onClick={handleCreateNode}
                      disabled={createNodeMutation.isPending}
                      className="w-full"
                    >
                      {createNodeMutation.isPending ? (
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : nodes && nodes.length > 0 ? (
              <div className="space-y-2">
                {nodes.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    isExpanded={expandedNodes.has(node.id)}
                    onToggleExpand={toggleExpand}
                    onSelect={setSelectedNode}
                    isSelected={selectedNode?.id === node.id}
                    onDelete={handleDeleteNode}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                {t("catalog.taxonomy.empty", "لا توجد تصنيفات حتى الآن")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Node Details Panel */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("catalog.taxonomy.details", "تفاصيل التصنيف")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    {t("catalog.fields.nameAr", "الاسم بالعربية")}
                  </p>
                  <p className="text-lg font-semibold">{selectedNode.nameAr}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    {t("catalog.fields.nameEn", "الاسم بالإنجليزية")}
                  </p>
                  <p className="text-lg">{selectedNode.nameEn}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    {t("catalog.fields.level", "المستوى")}
                  </p>
                  <p className="text-lg">{selectedNode.level}</p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    disabled={deleteNodeMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("common.delete", "حذف")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                {t("catalog.taxonomy.selectNode", "اختر تصنيفاً لعرض تفاصيله")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// TREE NODE ITEM COMPONENT
// ============================================================
interface TreeNodeItemProps {
  node: TreeNode;
  isExpanded: boolean;
  onToggleExpand: (nodeId: number) => void;
  onSelect: (node: TreeNode) => void;
  isSelected: boolean;
  onDelete: (nodeId: number) => void;
}

function TreeNodeItem({
  node,
  isExpanded,
  onToggleExpand,
  onSelect,
  isSelected,
  onDelete,
}: TreeNodeItemProps) {
  const { t } = useTranslation();
  const { data: children } = trpc.catalog.nodes.getChildren.useQuery(node.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
          isSelected ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-slate-50"
        )}
      >
        {children && children.length > 0 && (
          <button
            onClick={() => onToggleExpand(node.id)}
            className="p-1 hover:bg-slate-200 rounded"
          >
            <ChevronRight
              className={cn(
                "w-4 h-4 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        )}
        <div
          className="flex-1"
          onClick={() => onSelect(node)}
        >
          <p className="font-medium text-slate-900">{node.nameAr}</p>
          <p className="text-xs text-slate-500">{node.nameEn}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="p-1 hover:bg-red-100 rounded text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Children */}
      {isExpanded && children && children.length > 0 && (
        <div className="ml-6 space-y-1 border-l border-slate-200 pl-2">
          {children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              isExpanded={false}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              isSelected={isSelected}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
