import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text()); });
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED1");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  await page.goto("http://localhost:4001/tickets/2100010", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('textarea[placeholder="وصف المهمة المطلوبة *"]', { timeout: 45000 });
  await page.type('input[placeholder="عنوان المهمة (اختياري)"]', "UAT مهمة إنشاءات بالفريق");
  await page.type('textarea[placeholder="وصف المهمة المطلوبة *"]', "اختبار ظهور الإسناد حسب الاسم أو حسب فريق الصيانة لقسم الإنشاءات.");
  let createButton = null;
  for (const button of await page.$$("button")) {
    if ((await button.evaluate(node => node.textContent?.trim() || "")) === "إنشاء مهمة") { createButton = button; break; }
  }
  if (!createButton) throw new Error("Create task button missing");
  if (await createButton.evaluate(node => node.disabled)) throw new Error("Create task button disabled");
  await createButton.click();
  await page.waitForFunction(() => {
    const exact = text => [...document.querySelectorAll("*")].some(node => node.children.length === 0 && node.textContent?.trim() === text && node.getBoundingClientRect().height > 0);
    return exact("حسب الاسم") && exact("حسب فريق الصيانة");
  }, { timeout: 45000 });
  const result = await page.evaluate(() => {
    const exact = text => [...document.querySelectorAll("*")].filter(node => node.children.length === 0 && node.textContent?.trim() === text).map(node => ({ visible: node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().width > 0, tag: node.tagName }));
    return { byName: exact("حسب الاسم"), byTeam: exact("حسب فريق الصيانة"), relevant: document.body.innerText.split("\n").filter(line => line.includes("UAT مهمة") || line.includes("حسب الاسم") || line.includes("حسب فريق") || line.includes("بانتظار الإسناد")).slice(-50) };
  });
  console.log(JSON.stringify({ ...result, errors }, null, 2));
} finally { await browser.close(); }
