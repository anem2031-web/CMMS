import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  const errors = [];
  const responses = [];
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text()); });
  page.on("response", async response => {
    if (response.url().includes("departmentPlan")) {
      responses.push({ status: response.status(), url: response.url(), body: await response.text().catch(() => "<unreadable>") });
    } else if (response.url().includes("department") || response.url().includes("ticket")) {
      responses.push({ status: response.status(), url: response.url().slice(-240) });
    }
  });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED1");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  const started = Date.now();
  await page.goto("http://localhost:4001/tickets/2100010", { waitUntil: "domcontentloaded", timeout: 30000 });
  let loaded = false;
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return [...document.querySelectorAll("*")].some(node => node.children.length === 0 && node.textContent?.trim() === "الجهات والمهام")
        || text.includes("إنشاء مهمة") || text.includes("وصف المهمة");
    }, { timeout: 45000 });
    loaded = true;
  } catch {}
  const body = await page.evaluate(() => document.body.innerText);
  console.log(JSON.stringify({ loaded, elapsedMs: Date.now() - started, relevant: body.split("\n").filter(line => line.includes("جه") || line.includes("مهم") || line.includes("حسب الاسم") || line.includes("فريق الصيانة")).slice(-80), responses: responses.slice(-30), errors }, null, 2));
} finally { await browser.close(); }
