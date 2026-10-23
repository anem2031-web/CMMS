import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const chooseOption = async (page, buttonText, optionText) => {
  const buttons = await page.$$("button");
  const trigger = [];
  for (const button of buttons) {
    const text = await button.evaluate(node => node.textContent?.trim() || "");
    if (text === buttonText) trigger.push(button);
  }
  if (!trigger.length) throw new Error(`Select trigger not found: ${buttonText}`);
  await trigger.at(-1).click();
  await page.waitForFunction(() => document.querySelectorAll('[role="option"]').length > 0, { timeout: 15000 });
  const options = await page.$$('[role="option"]');
  let chosen = null;
  for (const option of options) {
    const text = await option.evaluate(node => node.textContent?.trim() || "");
    if (!optionText || text.includes(optionText)) { chosen = option; break; }
  }
  if (!chosen) throw new Error(`No option for ${buttonText}: ${optionText}`);
  await chosen.click();
  await sleep(1800);
};
const clickExact = async (page, text) => {
  const matches = [];
  for (const button of await page.$$("button")) {
    if ((await button.evaluate(node => node.textContent?.trim() || "")) === text) matches.push(button);
  }
  if (!matches.length) return false;
  await matches.at(-1).click();
  return true;
};

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text());
  });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED9");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  if (await page.$('input[placeholder="اسم المستخدم"]')) throw new Error("Login failed");

  await page.goto("http://localhost:4001/tickets/new", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(6000);
  const titleInput = await page.$('input:not([type="file"]):not([placeholder="بحث في القائمة..."])');
  if (!titleInput) throw new Error("Ticket title input not found");
  await titleInput.type("UAT-CONSTRUCTION-TEAM-20261023");
  const textarea = await page.$("textarea");
  await textarea.type("بلاغ اختبار للتحقق من إسناد مهمة الإنشاءات حسب الاسم أو حسب فريق الصيانة.");
  await chooseOption(page, "التصنيف", null);
  await chooseOption(page, "اختر الموقع", "حديقة الوطن");
  await chooseOption(page, "اختر القسم", null);
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile("C:/Users/mh/Desktop/CMMSFINAL/client/public/placeholder-image.png");
  await sleep(4000);
  if (!await clickExact(page, "بلاغ جديد")) throw new Error("Create ticket button not found");
  await sleep(8000);
  const createdUrl = page.url();
  const body = await page.evaluate(() => document.body.innerText);
  console.log(JSON.stringify({ createdUrl, created: /\/tickets\/\d+/.test(new URL(createdUrl).pathname), body: body.slice(-5000), errors }, null, 2));
} finally {
  await browser.close();
}
