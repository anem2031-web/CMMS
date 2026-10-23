import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clickExact = async (page, text) => {
  for (const node of await page.$$("button, a, [role=button]")) {
    if ((await node.evaluate(el => el.textContent?.trim() || "")) === text) {
      await node.click();
      return true;
    }
  }
  return false;
};
const chooseFirstOption = async (page, trigger) => {
  await page.click(trigger);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="option"]').length > 0,
    { timeout: 15000 },
  ).catch(() => undefined);
  const options = await page.$$('[role="option"]');
  if (!options.length) throw new Error(`No options for ${trigger}`);
  await options[0].click();
  await sleep(1200);
};
const chooseOptionContaining = async (page, trigger, text) => {
  await page.click(trigger);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="option"]').length > 0,
    { timeout: 15000 },
  ).catch(() => undefined);
  const options = await page.$$('[role="option"]');
  for (const option of options) {
    if ((await option.evaluate(element => element.textContent || "")).includes(text)) {
      await option.click();
      await sleep(1200);
      return;
    }
  }
  throw new Error(`Option ${text} not found for ${trigger}`);
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text());
  });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED3");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(5000);
  if (await page.$('input[placeholder="اسم المستخدم"]')) throw new Error("Login failed");

  await page.goto("http://localhost:4001/purchase-orders/new", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(5000);
  await chooseOptionContaining(page, "#purchase-site", "حديقة الوطن");
  await chooseFirstOption(page, "#purchase-section");

  if (!await clickExact(page, "من الكاتلوج")) throw new Error("Catalog button not found");
  await sleep(2500);
  const dialog = await page.$('[role="dialog"]');
  if (!dialog) throw new Error("Catalog dialog not opened");
  const search = await page.$('[role="dialog"] input');
  if (!search) throw new Error("Catalog search input not found");
  await search.type("UAT2-20261018");
  await sleep(2500);
  const selected = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = [...dialog.querySelectorAll("button")];
    const item = buttons.find(button => button.textContent?.includes("UAT2-20261018"));
    if (!item) return false;
    item.click();
    return true;
  });
  if (!selected) throw new Error("Catalog test item not found");
  await sleep(1500);

  const note = await page.$('textarea[placeholder]');
  if (note) await note.type("UAT-DRAFT-OWNER-20261023 — اختبار ظهور صنف المسودة لصاحبها");
  if (!await clickExact(page, "حفظ كمسودة")) throw new Error("Save draft button not found");
  await sleep(6000);
  const createdUrl = page.url();
  const createdBody = await page.evaluate(() => document.body.innerText);
  const draftId = Number(new URL(createdUrl).pathname.split("/").pop());
  if (!Number.isSafeInteger(draftId)) throw new Error(`Draft id missing from ${createdUrl}`);

  const editButtonText = (await page.$$eval("button", buttons => buttons.map(button => button.textContent?.trim() || "")))
    .find(text => text.includes("تعديل") && text.includes("مسودة"));
  if (editButtonText) await clickExact(page, editButtonText);
  else await page.goto(`http://localhost:4001/purchase-orders/edit-draft/${draftId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(5000);
  const editBody = await page.evaluate(() => document.body.innerText);
  const itemName = await page.$eval('#purchase-item-0-itemName', element => element.value).catch(() => "");
  const daysInput = await page.$('#purchase-item-0-deliveryLeadDays');
  if (daysInput) {
    await daysInput.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.keyboard.type("5");
    await page.keyboard.press("Tab");
    await sleep(500);
  }
  const saveChangesText = (await page.$$eval("button", buttons => buttons.map(button => button.textContent?.trim() || "")))
    .find(text => text.includes("حفظ") && text !== "حفظ كمسودة");
  if (!saveChangesText) throw new Error("Update draft button not found");
  await clickExact(page, saveChangesText);
  await sleep(5000);
  await page.goto(`http://localhost:4001/purchase-orders/edit-draft/${draftId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(4500);
  const reopenedItemName = await page.$eval('#purchase-item-0-itemName', element => element.value).catch(() => "");
  const reopenedDays = await page.$eval('#purchase-item-0-deliveryLeadDays', element => element.value).catch(() => "");
  const reopenedRequiredDate = await page.$eval('#purchase-item-0-requiredDate', element => element.value).catch(() => "");
  console.log(JSON.stringify({
    draftId,
    createdUrl,
    createdHasItem: createdBody.includes("UAT2-20261018"),
    editHasItem: editBody.includes("UAT2-20261018"),
    itemName,
    reopenedItemName,
    reopenedDays,
    reopenedRequiredDate,
    errors,
  }, null, 2));
} finally {
  await browser.close();
}
