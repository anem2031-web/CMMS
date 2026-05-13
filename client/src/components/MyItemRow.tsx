import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, DollarSign, FileText } from "lucide-react";

interface MyItemRowProps {
  item: any;
  t: any;
  locale: string;
  currency: string;
  onEstimate: (item: any) => void;
  onPurchase: (item: any) => void;
  onNavigateToPO: (poId: number) => void;
}

export const MyItemRow = React.memo(({ 
  item, 
  t, 
  locale, 
  currency, 
  onEstimate, 
  onPurchase, 
  onNavigateToPO 
}: MyItemRowProps) => {
  return (
    <Card className="hover:shadow-md transition-all duration-200 border-r-4" style={{ borderRightColor: item.status === "approved" ? "#10b981" : item.status === "purchased" ? "#8b5cf6" : item.status === "received" ? "#22c55e" : "#f59e0b" }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{item.itemName}</h3>
            {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
          </div>
          <Badge className="shrink-0 text-[10px] gap-1">
            {item.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
          <div className="bg-muted/50 rounded-lg p-2">
            <span className="text-muted-foreground block">{t.purchaseOrders.quantity}</span>
            <span className="font-bold">{item.quantity} {item.unit || ""}</span>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <span className="text-muted-foreground block">{t.purchaseOrders.poNumber}</span>
            <Button variant="link" className="h-auto p-0 text-xs font-bold" onClick={() => onNavigateToPO(item.purchaseOrderId)}>
              #{item.purchaseOrderId}
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

        {item.photoUrl && (
          <div className="mb-3">
            <img src={item.photoUrl} alt={item.itemName} className="w-full h-24 object-cover rounded-lg border" />
          </div>
        )}

        {item.notes && (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 mb-3">
            <FileText className="w-3 h-3 inline ml-1" />{item.notes}
          </p>
        )}

        {item.status === "pending" && (
          <Button size="sm" className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={() => onEstimate(item)}>
            <DollarSign className="w-3.5 h-3.5" /> {t.purchaseOrders.estimatedUnitCost}
          </Button>
        )}

        {item.status === "approved" && (
          <Button size="sm" className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => onPurchase(item)}>
            <ShoppingBag className="w-3.5 h-3.5" /> {t.purchaseOrders.confirmPurchase}
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

MyItemRow.displayName = "MyItemRow";
