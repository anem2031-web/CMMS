import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Settings,
  Package,
  FolderTree,
  AlertCircle,
} from "lucide-react";
import TaxonomyManager from "@/components/catalog/TaxonomyManager";
import ItemsManager from "@/components/catalog/ItemsManager";
import CatalogSettings from "@/components/catalog/CatalogSettings";
import SmartSearch from "@/components/catalog/SmartSearch";

export default function CatalogDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch catalog statistics
  const { data: nodes } = trpc.catalog.nodes.list.useQuery({
    isActive: true,
  });

  const { data: items } = trpc.catalog.items.list.useQuery({
    isActive: true,
    limit: 1,
  });

  const stats = {
    totalCategories: nodes?.length || 0,
    totalItems: items?.length || 0,
    activeSuppliers: 0, // Will be fetched later
    lastUpdated: new Date().toLocaleDateString(),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <Package className="w-10 h-10 text-blue-600" />
              {t("catalog.title", "وحدة الكتالوجات")}
            </h1>
            <p className="text-slate-600 mt-2">
              {t("catalog.description", "إدارة الأصناف والتصنيفات والموردين")}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title={t("catalog.stats.categories", "الأقسام")}
            value={stats.totalCategories}
            icon={<FolderTree className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title={t("catalog.stats.items", "الأصناف")}
            value={stats.totalItems}
            icon={<Package className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title={t("catalog.stats.suppliers", "الموردين")}
            value={stats.activeSuppliers}
            icon={<AlertCircle className="w-6 h-6" />}
            color="orange"
          />
          <StatCard
            title={t("catalog.stats.lastUpdated", "آخر تحديث")}
            value={stats.lastUpdated}
            icon={<Settings className="w-6 h-6" />}
            color="purple"
          />
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">
            {t("catalog.tabs.overview", "نظرة عامة")}
          </TabsTrigger>
          <TabsTrigger value="taxonomy">
            {t("catalog.tabs.taxonomy", "التصنيفات")}
          </TabsTrigger>
          <TabsTrigger value="items">
            {t("catalog.tabs.items", "الأصناف")}
          </TabsTrigger>
          <TabsTrigger value="settings">
            {t("catalog.tabs.settings", "الإعدادات")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                {t("catalog.search.title", "البحث الذكي")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SmartSearch />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("catalog.overview.recentItems", "الأصناف المضافة مؤخراً")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-slate-500">
                {t("catalog.overview.noItems", "لا توجد أصناف حتى الآن")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Taxonomy Tab */}
        <TabsContent value="taxonomy">
          <TaxonomyManager />
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items">
          <ItemsManager />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <CatalogSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// STAT CARD COMPONENT
// ============================================================
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "orange" | "purple";
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
  };

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
          </div>
          <div className="opacity-20">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
