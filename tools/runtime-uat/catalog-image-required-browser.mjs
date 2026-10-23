import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickExact = async (page, text) => {
  const handles = await page.$$("button, [role=tab], [role=button]");
  for (const handle of handles) {
    if ((await handle.evaluate(el => el.textContent?.trim() || "")) === text) {
      await handle.click();
      return true;
    }
  }
  return false;
};

try {
  const page = await browser.newPage();
  const messages = [];
  page.on("console", msg => {
    if (["error", "warning"].includes(msg.type())) messages.push(`${msg.type()}: ${msg.text()}`);
  });
  await page.goto("http://localhost:4001/", { waitUntil: "networkidle2", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED9");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[placeholder="اسم المستخدم"]'), { timeout: 30000 });
  await page.goto("http://localhost:4001/catalog", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(3000);
  const itemsTab = await clickExact(page, "الأصناف");
  await sleep(4000);
  const addClicked = await clickExact(page, "إضافة صنف");
  await sleep(1000);

  const dialogText = await page.$eval('[role="dialog"]', el => el.innerText);
  const saveButton = await page.$eval('[role="dialog"] button[type="submit"], [role="dialog"] button:last-of-type', el => ({
    text: el.textContent?.trim(),
    disabled: el.disabled,
  })).catch(() => null);
  const imageInput = await page.$eval('[role="dialog"] input[type="file"]', el => ({
    accept: el.accept,
    required: el.required,
  })).catch(() => null);
  const inputs = await page.$$eval('[role="dialog"] input', elements => elements.map(el => ({
    type: el.type,
    placeholder: el.placeholder,
    value: el.value,
  })));

  await clickExact(page, "اختر التصنيف *");
  await sleep(500);
  const node = await page.$('[role="dialog"] .cursor-pointer');
  if (node) await node.click();
  await sleep(1000);
  await page.type('[role="dialog"] input[placeholder="مثال: مضخة مياه"]', "UAT-NO-IMAGE-SHOULD-NOT-SAVE");
  await page.type('[role="dialog"] input[placeholder="Example: Water Pump"]', "UAT NO IMAGE SHOULD NOT SAVE");
  const requests = [];
  page.on("request", request => {
    if (request.method() !== "GET" && request.url().includes("catalog")) requests.push(`${request.method()} ${request.url()}`);
  });
  await clickExact(page, "حفظ");
  await sleep(1200);
  const afterSaveBody = await page.evaluate(() => document.body.innerText);

  console.log(JSON.stringify({
    itemsTab,
    addClicked,
    dialogHasRequiredImageText: dialogText.includes("صورة الصنف") && (dialogText.includes("إلزام") || dialogText.includes("مطلوب") || dialogText.includes("*")),
    imageInput,
    inputs,
    noImageGuardMessageVisible: afterSaveBody.includes("صورة الصنف إلزامية؛ يرجى إضافة صورة قبل الحفظ"),
    dialogStillOpenAfterBlockedSave: Boolean(await page.$('[role="dialog"]')),
    catalogWriteRequests: requests,
    saveButton,
    dialogExcerpt: dialogText.split("\n").filter(Boolean).slice(-18),
    messages,
  }, null, 2));
} finally {
  await browser.close();
}
