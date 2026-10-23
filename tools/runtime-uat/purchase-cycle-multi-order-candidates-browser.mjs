import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:4001", { waitUntil: "networkidle2", timeout: 30_000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[placeholder="اسم المستخدم"]'), { timeout: 30_000 });
  await page.goto("http://localhost:4001/purchase-cycle", { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise(resolve => setTimeout(resolve, 8_000));

  const result = await page.evaluate(() => {
    const actionable = [...document.querySelectorAll("button, a")]
      .filter(element => /إدخال المخزون|الاستلام/.test(element.textContent || ""));
    return actionable.map(element => {
      const card = element.closest("[class*='border'], [class*='card']") || element.parentElement?.parentElement;
      const text = card?.textContent || "";
      return {
        action: element.textContent?.trim(),
        href: element.getAttribute("href"),
        card: text.replace(/\s+/g, " ").trim().slice(0, 1800),
        poNumbers: [...new Set(text.match(/PR-\d{4}-\d+/g) || [])],
      };
    });
  });
  if (result.length === 1) {
    const target = [...await page.$$("button, a")];
    for (const element of target) {
      if (/إدخال المخزون/.test(await element.evaluate(node => node.textContent || ""))) {
        await element.click();
        await new Promise(resolve => setTimeout(resolve, 5_000));
        break;
      }
    }
  }
  console.log(JSON.stringify({
    url: page.url(),
    count: result.length,
    candidates: result,
    destination: (await page.evaluate(() => document.body.innerText)).slice(-10_000),
  }, null, 2));
} finally {
  await browser.close();
}
