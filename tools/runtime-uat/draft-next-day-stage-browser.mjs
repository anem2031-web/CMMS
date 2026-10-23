import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED3");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  await page.goto("http://localhost:4001/purchase-orders/edit-draft/3840006", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('#purchase-item-0-itemName', { timeout: 45000 });
  const values = await page.evaluate(() => ({
    itemName: document.querySelector('#purchase-item-0-itemName')?.value ?? "",
    days: document.querySelector('#purchase-item-0-deliveryLeadDays')?.value ?? "",
    requiredDate: document.querySelector('#purchase-item-0-requiredDate')?.value ?? "",
    buttons: [...document.querySelectorAll("button")].map(button => button.textContent?.trim() || "").filter(text => text.includes("إرسال") || text.includes("حفظ")),
  }));
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), ...values }, null, 2));
} finally { await browser.close(); }
