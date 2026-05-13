import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface POItem {
  id: number;
  itemName: string;
  description?: string;
  quantity: number;
  unit?: string;
  estimatedUnitCost?: string;
  estimatedTotalCost?: string;
  status: string;
  specifications?: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  createdAt: Date | string;
  items?: POItem[];
}

export function exportEstimatedItemsToPDF(po: PurchaseOrder, locale: string = 'ar') {
  // Filter only estimated items
  const estimatedItems = (po.items || []).filter(item => item.status === 'estimated');
  
  if (estimatedItems.length === 0) {
    throw new Error('لا توجد أصناف مُسعرة لتصديرها');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Set RTL direction for Arabic
  (doc as any).setR2L(true);

  // Add title
  doc.setFontSize(16);
  doc.setFont('Courier', 'bold');
  doc.text(`الأصناف المُسعرة - طلب الشراء #${po.poNumber}`, 15, 15);

  // Add date
  doc.setFontSize(10);
  doc.setFont('Courier', 'normal');
  const createdDate = new Date(po.createdAt).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`التاريخ: ${createdDate}`, 15, 25);

  // Prepare table data
  const tableData = estimatedItems.map((item) => [
    item.itemName,
    item.specifications || item.description || '-',
    item.quantity.toString(),
    item.unit || '-',
    parseFloat(item.estimatedUnitCost || '0').toFixed(2),
    parseFloat(item.estimatedTotalCost || '0').toFixed(2),
  ]);

  // Calculate total
  const totalCost = estimatedItems.reduce(
    (sum, item) => sum + parseFloat(item.estimatedTotalCost || '0'),
    0
  );

  // Add table
  autoTable(doc, {
    head: [['اسم الصنف', 'المواصفات', 'الكمية', 'الوحدة', 'السعر التقديري', 'الإجمالي']],
    body: tableData,
    startY: 35,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'right' },
      1: { halign: 'right' },
    },
    margin: { top: 35, right: 15, bottom: 20, left: 15 },
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.pages.length - 1;
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      doc.setFontSize(9);
      doc.text(
        `صفحة ${data.pageNumber} من ${pageCount}`,
        pageSize.getWidth() / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    },
  });

  // Add total row
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('Courier', 'bold');
  doc.setFontSize(12);
  doc.text(`إجمالي القيمة المُسعرة: ${totalCost.toFixed(2)} ر.س`, 15, finalY);

  // Save the PDF
  doc.save(`PO_${po.poNumber}_estimated_items.pdf`);
}
