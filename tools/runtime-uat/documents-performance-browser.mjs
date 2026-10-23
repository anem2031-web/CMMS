import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text()); });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED9");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  const started = Date.now();
  await page.goto("http://localhost:4001/documents", { waitUntil: "domcontentloaded", timeout: 30000 });
  const domMs = Date.now() - started;
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return document.querySelectorAll("tbody tr").length > 0
      || text.includes("لا توجد مستندات مطابقة")
      || text.includes("تعذر تحميل بعض المستندات");
  }, { timeout: 60000 }).catch(() => undefined);
  const stableMs = Date.now() - started;
  await sleep(1500);
  const result = await page.evaluate(() => ({
    text: document.body.innerText.slice(-10000),
    rows: document.querySelectorAll("tbody tr").length,
    cards: document.querySelectorAll('[class*="Card"]').length,
    buttons: [...document.querySelectorAll("button")].map(button => button.textContent?.trim() || "").filter(Boolean).slice(-80),
  }));
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => ({ name: entry.name, duration: Math.round(entry.duration), startTime: Math.round(entry.startTime) })).filter(entry => entry.duration > 1000).sort((a, b) => b.duration - a.duration).slice(0, 20));
  console.log(JSON.stringify({ domMs, stableMs, ...result, resources, errors }, null, 2));
} finally { await browser.close(); }
