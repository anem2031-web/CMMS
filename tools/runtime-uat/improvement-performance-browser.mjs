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
  await page.goto("http://localhost:4001/improvement-ideas?ideaId=300001", { waitUntil: "domcontentloaded", timeout: 30000 });
  const domMs = Date.now() - started;
  let panelMs = null;
  let panelText = null;
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("التنفيذ والتكاليف") || text.includes("لوحة التنفيذ") || text.includes("تكلفة التنفيذ");
    }, { timeout: 60000 });
    panelMs = Date.now() - started;
    panelText = await page.evaluate(() => document.body.innerText.split("\n").filter(line => line.includes("تنفيذ") || line.includes("تكلف")).slice(-20));
  } catch {
    panelText = (await page.evaluate(() => document.body.innerText)).slice(-6000);
  }
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => ({ name: entry.name, duration: Math.round(entry.duration), startTime: Math.round(entry.startTime) })).filter(entry => entry.duration > 1000).sort((a, b) => b.duration - a.duration).slice(0, 15));
  console.log(JSON.stringify({ domMs, panelMs, panelText, resources, errors }, null, 2));
} finally { await browser.close(); }
