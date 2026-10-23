import puppeteer from "puppeteer-core";
const launch = () => puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const login = async page => {
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED3");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
};
const read = async page => page.evaluate(() => ({
  bodyHasItem: document.body.innerText.includes("UAT2-20261018-BASE"),
  itemName: document.querySelector('#purchase-item-0-itemName')?.value ?? "",
  days: document.querySelector('#purchase-item-0-deliveryLeadDays')?.value ?? "",
  requiredDate: document.querySelector('#purchase-item-0-requiredDate')?.value ?? "",
}));
let first;
{
  const browser = await launch();
  const page = await browser.newPage();
  await login(page);
  await page.goto("http://localhost:4001/purchase-orders/edit-draft/3840006", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('#purchase-item-0-deliveryLeadDays', { timeout: 45000 });
  const days = await page.$('#purchase-item-0-deliveryLeadDays');
  await days.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await days.type("6");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.querySelector('#purchase-item-0-requiredDate')?.value === "2026-10-29", { timeout: 10000 }).catch(() => undefined);
  const beforeSave = await read(page);
  const responsePromise = page.waitForResponse(response => response.url().includes("/api/trpc/") && response.request().method() === "POST", { timeout: 30000 }).catch(() => null);
  let saveButton = null;
  for (const button of await page.$$("button")) if ((await button.evaluate(node => node.textContent?.trim() || "")) === "حفظ التعديلات") { saveButton = button; break; }
  if (!saveButton) throw new Error("Save changes button missing");
  await saveButton.click();
  const response = await responsePromise;
  await sleep(5000);
  first = { beforeSave, afterSaveUrl: page.url(), responseStatus: response?.status() ?? null, afterSaveBody: (await page.evaluate(() => document.body.innerText)).slice(-2500) };
  await browser.close();
}
await sleep(35000);
{
  const browser = await launch();
  const page = await browser.newPage();
  await login(page);
  await page.goto("http://localhost:4001/purchase-orders/edit-draft/3840006", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('#purchase-item-0-deliveryLeadDays', { timeout: 45000 });
  const fresh = await read(page);
  console.log(JSON.stringify({ first, fresh }, null, 2));
  await browser.close();
}
