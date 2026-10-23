import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

const clickText = async (page, text) => {
  const candidates = await page.$$("button, [role=button]");
  for (const candidate of candidates) {
    if ((await candidate.evaluate(element => element.textContent?.trim() || "")) === text) {
      await candidate.click();
      await new Promise(resolve => setTimeout(resolve, 1_000));
      return;
    }
  }
  throw new Error(`Button not found: ${text}`);
};

const setInput = async (page, selector, value) => page.evaluate(({ selector, value }) => {
  const input = document.querySelector(selector);
  if (!input) throw new Error(`Input not found: ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}, { selector, value });

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:4001", { waitUntil: "networkidle2", timeout: 30_000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[placeholder="اسم المستخدم"]'), { timeout: 30_000 });

  const route = "/warehouse/receive-v2?poId=3840005&invoiceNumber=UAT-PB150001-20261021-01&purchaseOrderIds=3840005,3810005";
  await page.goto(`http://localhost:4001${route}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise(resolve => setTimeout(resolve, 3_000));
  if (!(await page.evaluate(() => [...document.querySelectorAll("button")].some(button => button.textContent?.trim() === "إدخال يدوي بدون تحليل")))) {
    console.log(JSON.stringify({
      phase: "receipt-entry-unavailable",
      url: page.url(),
      body: (await page.evaluate(() => document.body.innerText)).slice(-12_000),
      buttons: await page.evaluate(() => [...document.querySelectorAll("button")].map(button => button.innerText.trim()).filter(Boolean)),
    }, null, 2));
    await browser.close();
    process.exit(2);
  }
  await clickText(page, "إدخال يدوي بدون تحليل");

  await setInput(page, 'input[placeholder="اسم المورد"]', "UAT مورد اختبار الحزمة");
  await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find(element => element.textContent?.includes("مورد جديد"));
    if (!label) throw new Error("New supplier control not found");
    label.click();
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  await setInput(page, 'input[placeholder="INV-001"]', "UAT-PB150001-20261021-01");
  await setInput(page, 'input[type="date"]', "2026-10-21");
  const money = await page.$$('input[type="number"]');
  const values = ["2.00", "0.30", "2.30"];
  for (let index = 0; index < Math.min(money.length, values.length); index += 1) {
    await money[index].evaluate((input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, values[index]);
  }

  await clickText(page, "التالي: مراجعة الأصناف");
  await new Promise(resolve => setTimeout(resolve, 3_000));

  for (let itemIndex = 0; itemIndex < 2; itemIndex += 1) {
    if (itemIndex === 1) {
      console.error(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("button")]
        .filter(element => element.textContent?.trim() === "اختر وحدة الصرف")
        .map(element => ({ disabled: element.disabled, html: element.outerHTML, card: element.closest(".border")?.innerText?.slice(0, 500) }))), null, 2));
    }
    const unitButtons = await page.$$("button");
    let unitButton = null;
    for (const button of unitButtons) {
      if ((await button.evaluate(element => element.textContent?.trim() || "")) === "اختر وحدة الصرف") {
        unitButton = button;
        break;
      }
    }
    if (!unitButton) throw new Error(`Issue unit button not found for item ${itemIndex + 1}`);
    if (itemIndex === 1) {
      await unitButton.focus();
      await page.keyboard.press("Space");
    } else {
      await unitButton.click();
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const options = await page.$$('[role="option"]');
    let selected = false;
    for (const option of options) {
      const optionText = await option.evaluate(element => element.textContent?.trim() || "");
      if (optionText.includes("قطعة")) {
        await option.click();
        selected = true;
        break;
      }
    }
    if (!selected) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await new Promise(resolve => setTimeout(resolve, 500));
      const remaining = await page.evaluate(() => [...document.querySelectorAll("button")]
        .filter(element => element.textContent?.trim() === "اختر وحدة الصرف").length);
      if (remaining > 0) {
        const optionTexts = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].map(element => element.textContent?.trim()));
        throw new Error(`Piece option not found for item ${itemIndex + 1}: ${JSON.stringify(optionTexts)}`);
      }
    }
  }

  const conversionInputs = await page.$$('input[type="number"]');
  for (const input of conversionInputs) {
    const current = await input.evaluate(element => element.value);
    if (current !== "0") continue;
    await input.evaluate(element => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(element, "1");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  await clickText(page, "التالي: تأكيد الاستلام");
  await new Promise(resolve => setTimeout(resolve, 2_000));
  const beforeConfirm = page.url();
  await clickText(page, "تأكيد الاستلام");
  await new Promise(resolve => setTimeout(resolve, 5_000));
  console.log(JSON.stringify({
    beforeConfirm,
    url: page.url(),
    body: (await page.evaluate(() => document.body.innerText)).slice(-12_000),
    buttons: await page.evaluate(() => [...document.querySelectorAll("button")].map(button => ({ text: button.innerText.trim(), disabled: button.disabled })).filter(button => button.text)),
    inputs: await page.evaluate(() => [...document.querySelectorAll("input")].map(input => ({ type: input.type, value: input.value, placeholder: input.placeholder }))),
  }, null, 2));
} finally {
  await browser.close();
}
