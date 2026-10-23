import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  await sleep(5000);
  if (await page.$('input[placeholder="اسم المستخدم"]')) {
    console.log(JSON.stringify({ login: false, body: (await page.evaluate(() => document.body.innerText)).slice(0, 1500), errors }, null, 2));
    process.exitCode = 2;
  } else {
    await page.goto("http://localhost:4001/tickets?tab=construction", { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(8000);
    const links = await page.$$eval('a[href^="/tickets/"]', nodes => [...new Set(nodes.map(node => node.getAttribute("href")).filter(Boolean))]);
    const listExcerpt = links.length ? null : (await page.evaluate(() => document.body.innerText)).slice(-6000);
    const checked = [];
    let match = null;
    for (const href of links.slice(0, 30)) {
      await page.goto(`http://localhost:4001${href}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(3000);
      const body = await page.evaluate(() => document.body.innerText);
      const row = {
        href,
        construction: body.includes("الإنشاءات"),
        byName: body.includes("حسب الاسم"),
        byTeam: body.includes("حسب فريق الصيانة"),
        hasTask: body.includes("مهمة") || body.includes("المهام"),
      };
      checked.push(row);
      if (row.construction && row.byName && row.byTeam) { match = row; break; }
    }
    if (!links.length) {
      for (let index = 0; index < 10; index += 1) {
        await page.goto("http://localhost:4001/tickets?tab=construction", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(3000);
        const buttons = await page.$$("button");
        const openButtons = [];
        for (const button of buttons) {
          if ((await button.evaluate(node => node.textContent?.trim() || "")) === "فتح البلاغ") openButtons.push(button);
        }
        if (!openButtons[index]) break;
        await openButtons[index].click();
        await sleep(3500);
        const body = await page.evaluate(() => document.body.innerText);
        const row = {
          href: new URL(page.url()).pathname,
          construction: body.includes("الإنشاءات"),
          byName: body.includes("حسب الاسم"),
          byTeam: body.includes("حسب فريق الصيانة"),
          hasTask: body.includes("مهمة") || body.includes("المهام"),
        };
        checked.push(row);
        if (row.construction && row.byName && row.byTeam) { match = row; break; }
      }
    }
    console.log(JSON.stringify({ login: true, listCount: links.length, listExcerpt, match, checked, errors }, null, 2));
  }
} finally {
  await browser.close();
}
