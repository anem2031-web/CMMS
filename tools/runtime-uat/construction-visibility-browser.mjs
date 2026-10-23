import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:4001/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED9");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await sleep(6000);
  await page.goto("http://localhost:4001/tickets/2100010", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(7000);
  const matches = await page.evaluate(() => ["حسب الاسم", "حسب فريق الصيانة"].map(text => {
    const nodes = [...document.querySelectorAll("*")].filter(node => node.children.length === 0 && node.textContent?.trim() === text);
    return { text, count: nodes.length, visible: nodes.some(node => { const rect = node.getBoundingClientRect(); const style = getComputedStyle(node); return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"; }) };
  }));
  console.log(JSON.stringify({ matches, statusExcerpt: (await page.evaluate(() => document.body.innerText)).split("\n").filter(line => line.includes("الإنشاءات") || line.includes("حسب ") || line.includes("بانتظار")).slice(-40) }, null, 2));
} finally { await browser.close(); }
