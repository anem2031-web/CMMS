import QRCode from "qrcode";
import { useEffect, useRef } from "react";

export interface LotLabelItem {
  lotId: number;
  lotCode: string;
  trackingToken: string;
  itemName: string;
  quantity: number;
  unit?: string;
  sourceType: "receipt" | "opening_balance";
  receiptNumber?: string;
  settlementNumber?: string;
}

function QRCodeCanvas({ value, size = 110 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(console.error);
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}

export default function LotLabelsPrintScreen({
  items,
  onDone,
}: {
  items: LotLabelItem[];
  onDone: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
      <div className="print-hidden max-w-2xl mx-auto mb-4 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">طباعة ملصقات الدفعات</h1>
          <p className="text-xs text-gray-600">كل QR يعرّف Lot واحداً داخل CMMS.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            🖨️ طباعة الملصقات
          </button>
          <button
            onClick={onDone}
            className="border bg-white px-4 py-2 rounded-lg text-sm text-gray-700"
          >
            تم
          </button>
        </div>
      </div>

      <div className="lot-label-print-area flex flex-wrap gap-4 justify-center">
        {items.map((item) => (
          <div
            key={item.lotId}
            className="lot-label-card"
            style={{
              width: "56mm",
              height: "36mm",
              display: "flex",
              alignItems: "center",
              padding: "2px",
              gap: "4px",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <QRCodeCanvas value={item.trackingToken} />
            </div>
            <div style={{ flex: 1, overflow: "hidden", textAlign: "right" }}>
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "11px", direction: "ltr" }}>
                {item.lotCode}
              </div>
              <div style={{ fontSize: "10px", lineHeight: 1.25, marginTop: "3px" }}>{item.itemName}</div>
              <div style={{ fontSize: "9px", marginTop: "3px" }}>
                {item.quantity} {item.unit || ""}
              </div>
              <div style={{ fontSize: "8px", color: "#555", marginTop: "2px" }}>
                {item.sourceType === "opening_balance" ? "رصيد افتتاحي" : "دفعة استلام"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: 58mm 38mm; margin: 0; }
          body * { visibility: hidden; }
          .lot-label-print-area, .lot-label-print-area * { visibility: visible; }
          .lot-label-print-area { position: absolute; top: 0; left: 0; }
          .print-hidden { display: none !important; }
          .lot-label-card {
            width: 56mm !important;
            height: 36mm !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .lot-label-card:last-child { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}
