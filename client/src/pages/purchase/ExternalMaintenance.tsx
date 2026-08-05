import { useAuth } from "@/_core/hooks/useAuth";
import { Wrench, ShieldAlert } from "lucide-react";
import ExternalMaintenanceWarehouseTab from "./ExternalMaintenanceWarehouseTab";

export default function ExternalMaintenance() {
  const { user } = useAuth();
  const role = user?.role;
  const isAllowed = role === "warehouse" || role === "owner" || role === "admin";

  if (!isAllowed) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
          <h1 className="text-lg font-bold">ليس لديك صلاحية للوصول لهذه الصفحة</h1>
          <p className="text-sm text-muted-foreground">
            صفحة الصيانة الخارجية (المسار C) متاحة لحساب المستودع فقط.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">صيانة خارجية</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        تجهيز أصول المسار C للخروج للصيانة الخارجية، ومتابعة دورتها الكاملة حتى استلامها
        وتسليمها لإعادة التركيب — وفق ترتيب البلاغات التي اعتمد لها المسار C فقط.
      </p>

      <ExternalMaintenanceWarehouseTab />
    </div>
  );
}
