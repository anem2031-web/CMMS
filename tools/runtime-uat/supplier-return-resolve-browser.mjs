import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text()); });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  await page.goto("http://localhost:4001/warehouse/return", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent?.includes("اختر المستودع قبل المسح")), { timeout: 45000 });
  const warehouseTrigger = await page.$x?.('//button[contains(., "اختر المستودع قبل المسح")]');
  const buttons = await page.$$("button");
  let trigger = null;
  for (const button of buttons) {
    if ((await button.evaluate(node => node.textContent || "")).includes("اختر المستودع قبل المسح")) { trigger = button; break; }
  }
  if (!trigger) throw new Error("Warehouse select missing");
  await trigger.click();
  await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length > 0, { timeout: 15000 });
  const options = await page.$$('[role="option"]');
  const optionNames = [];
  for (const option of options) optionNames.push(await option.evaluate(node => node.textContent?.trim() || ""));
  const warehouseIndex = Number(process.argv[2] || 0);
  if (!options[warehouseIndex]) throw new Error(`Warehouse index ${warehouseIndex} missing`);
  await options[warehouseIndex].click();
  await sleep(1500);
  const scan = await page.$('input[placeholder*="امسح QR الخاص بالدفعة"]');
  if (!scan) throw new Error("Lot scan input missing");
  await scan.type(process.argv[3] || "LOT-2026-00783");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.body.innerText.includes("جاري التحقق من الدفعة ومصدرها"), { timeout: 45000 }).catch(() => undefined);
  await sleep(1000);
  const body = await page.evaluate(() => document.body.innerText);
  const resolved = body.includes("مصدر المرتجع محدد من QR");
  let submitted = false;
  if (resolved && process.argv.includes("submit")) {
    const reason = await page.$('input[placeholder*="صنف معطوب"]');
    if (!reason) throw new Error("Return reason input missing");
    await reason.type("UAT-20261023 — مرتجع مورد لاختبار الدورة الكاملة على بيانات الاختبار فقط");
    await page.keyboard.press("Tab");
    await sleep(1000);
    for (const button of await page.$$("button")) {
      if ((await button.evaluate(node => node.textContent?.trim() || "")) === "تأكيد الإرجاع") {
        const disabled = await button.evaluate(node => node.disabled);
        if (disabled) throw new Error("Confirm return button remained disabled after entering reason");
        await button.click();
        submitted = true;
        break;
      }
    }
    await sleep(8000);
  }
  const finalBody = await page.evaluate(() => document.body.innerText);
  console.log(JSON.stringify({ optionNames, selectedWarehouse: optionNames[warehouseIndex], resolved, submitted, finalUrl: page.url(), body: finalBody.slice(-6000), errors }, null, 2));
} finally { await browser.close(); }
