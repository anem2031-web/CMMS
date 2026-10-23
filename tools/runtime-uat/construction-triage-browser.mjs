import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickFirstExact = async (page, text) => {
  for (const button of await page.$$("button")) {
    if ((await button.evaluate(node => node.textContent?.trim() || "")) === text) { await button.click(); return true; }
  }
  return false;
};
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text()); });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED9");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  await page.goto("http://localhost:4001/triage", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(7000);
  if (!await clickFirstExact(page, "فرز وتصنيف البلاغ")) throw new Error("Triage button missing");
  await sleep(1500);
  const checks = await page.$$('input[type="checkbox"]');
  if (checks.length < 2) throw new Error(`Expected construction checkbox; found ${checks.length}`);
  await checks[1].click();
  await sleep(1800);
  const constructionTitle = await page.$('input[placeholder="مثال: إعادة تأهيل مبنى الإدارة"]');
  if (!constructionTitle) throw new Error("Construction organizational title input not found");
  await constructionTitle.type("UAT — اختبار إسناد فريق الإنشاءات");
  await page.keyboard.press("Tab");
  await sleep(500);
  const dialogButtons = await page.$$('[role="dialog"] button');
  const selectTriggers = [];
  for (const button of dialogButtons) {
    const text = await button.evaluate(node => node.textContent?.trim() || "");
    if (text.includes("اختر") || text.includes("مسؤول")) selectTriggers.push({ button, text });
  }
  if (selectTriggers.length) {
    await selectTriggers.at(-1).button.click();
    await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length > 0, { timeout: 15000 });
    const option = (await page.$$('[role="option"]'))[0];
    await option.click();
    await sleep(1000);
  }
  const confirmText = (await page.$$eval('button', nodes => nodes.map(node => node.textContent?.trim() || ""))).find(text => text.startsWith("تأكيد الفرز المتعدد"));
  if (!confirmText) throw new Error("Confirm triage button missing");
  const confirmButton = (await page.$$("button"));
  for (const button of confirmButton) {
    if ((await button.evaluate(node => node.textContent?.trim() || "")) === confirmText && await button.evaluate(node => node.disabled)) {
      throw new Error(`Confirm triage button disabled: ${confirmText}`);
    }
  }
  if (!await clickFirstExact(page, confirmText)) throw new Error("Confirm triage click failed");
  await sleep(8000);
  await page.goto("http://localhost:4001/tickets/2100010", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(7000);
  const body = await page.evaluate(() => document.body.innerText);
  console.log(JSON.stringify({ url: page.url(), construction: body.includes("الإنشاءات"), byName: body.includes("حسب الاسم"), byTeam: body.includes("حسب فريق الصيانة"), body: body.slice(-7000), errors }, null, 2));
} finally { await browser.close(); }
