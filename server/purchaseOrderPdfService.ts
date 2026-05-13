import puppeteer from 'puppeteer';

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

export async function generateEstimatedItemsPDF(po: PurchaseOrder): Promise<Buffer> {
  // Filter only estimated items
  const estimatedItems = (po.items || []).filter(item => item.status === 'estimated');
  
  if (estimatedItems.length === 0) {
    throw new Error('لا توجد أصناف مُسعرة لتصديرها');
  }

  // Calculate total
  const totalCost = estimatedItems.reduce(
    (sum, item) => sum + parseFloat(item.estimatedTotalCost || '0'),
    0
  );

  // Create HTML content
  const createdDate = new Date(po.createdAt).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tableRows = estimatedItems.map((item) => `
    <tr>
      <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${item.itemName}</td>
      <td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${item.specifications || item.description || '-'}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${item.quantity}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${item.unit || '-'}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${parseFloat(item.estimatedUnitCost || '0').toFixed(2)}</td>
      <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${parseFloat(item.estimatedTotalCost || '0').toFixed(2)}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>الأصناف المُسعرة</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          direction: rtl;
          margin: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #2980b9;
          padding-bottom: 15px;
        }
        .header h1 {
          margin: 0;
          color: #2980b9;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        .po-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 14px;
        }
        .po-info div {
          flex: 1;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        thead {
          background-color: #2980b9;
          color: white;
        }
        thead th {
          padding: 12px;
          text-align: center;
          font-weight: bold;
          border: 1px solid #2980b9;
        }
        tbody td {
          padding: 10px;
          border: 1px solid #ddd;
        }
        tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total-row {
          margin-top: 20px;
          text-align: left;
          font-size: 16px;
          font-weight: bold;
          color: #2980b9;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>الأصناف المُسعرة</h1>
        <p>طلب الشراء #${po.poNumber}</p>
      </div>
      
      <div class="po-info">
        <div>
          <strong>رقم الطلب:</strong> ${po.poNumber}
        </div>
        <div>
          <strong>التاريخ:</strong> ${createdDate}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>اسم الصنف</th>
            <th>المواصفات</th>
            <th>الكمية</th>
            <th>الوحدة</th>
            <th>السعر التقديري</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div class="total-row">
        إجمالي القيمة المُسعرة: ${totalCost.toFixed(2)} ر.س
      </div>

      <div class="footer">
        <p>تم إنشاء هذا التقرير بواسطة نظام إدارة طلبات الشراء</p>
        <p>${new Date().toLocaleString('ar-SA')}</p>
      </div>
    </body>
    </html>
  `;

  // Generate PDF using Puppeteer
  let browser: any;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      printBackground: true,
    });

    await page.close();
    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
