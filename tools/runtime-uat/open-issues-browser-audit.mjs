import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function inspect(username, route, inspect) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("debug-collector")) errors.push(message.text());
  });
  try {
    await page.goto("http://localhost:4001", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.type('input[placeholder="اسم المستخدم"]', username);
    await page.type('input[placeholder="كلمة المرور"]', "A1234567");
    await page.click('button[type="submit"]');
    await sleep(6_000);
    if (await page.$('input[placeholder="اسم المستخدم"]')) {
      return { username, route, url: page.url(), errors, loginFailed: true, excerpt: (await page.evaluate(() => document.body.innerText)).slice(-3_000) };
    }
    await page.goto(`http://localhost:4001${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await sleep(8_000);
    return { username, route, url: page.url(), errors, ...(await inspect(page)) };
  } finally {
    await context.close();
  }
}

try {
  const results = [];
  results.push(await inspect("RED8", "/tickets/inbox", async page => {
    const buttons = await page.$$("button, [role=tab]");
    for (const button of buttons) {
      const text = await button.evaluate(node => node.textContent?.trim() || "");
      if (text.includes("الحرجة")) { await button.click(); await sleep(3_000); break; }
    }
    const body = await page.evaluate(() => document.body.innerText);
    return { kind: "critical", hasClosedLabel: /\nمغلق\n|الحالة:\s*مغلق/.test(body), excerpt: body.slice(-9_000) };
  }));

  results.push(await inspect("RED8", "/inventory-settlement-review", async page => {
    const body = await page.evaluate(() => document.body.innerText);
    return { kind: "settlement", dateLines: body.split("\n").filter(line => /\d{1,2}[:/]\d{1,2}/.test(line)).slice(-30), excerpt: body.slice(-7_000) };
  }));

  results.push(await inspect("RED", "/warehouse/issue", async page => {
    const body = await page.evaluate(() => document.body.innerText);
    return { kind: "standalone-issue", actions: await page.evaluate(() => [...document.querySelectorAll("button")].map(node => node.textContent?.trim()).filter(Boolean)), excerpt: body.slice(-8_000) };
  }));

  results.push(await inspect("RED4", "/documents", async page => {
    const body = await page.evaluate(() => document.body.innerText);
    const links = await page.evaluate(() => [...document.querySelectorAll("a")].map(node => ({ text: node.textContent?.trim(), href: node.getAttribute("href") })).filter(row => row.text || row.href));
    return { kind: "accountant-documents", purchaseDetailLinks: links.filter(row => row.href?.includes("/purchase-orders/")), excerpt: body.slice(-8_000) };
  }));

  results.push(await inspect("RED9", "/improvement-ideas", async page => {
    const body = await page.evaluate(() => document.body.innerText);
    return { kind: "improvement", waitingCostLines: body.split("\n").filter(line => /تكلفة|دراسة|فرز|انتظار/.test(line)).slice(-60), excerpt: body.slice(-8_000) };
  }));

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
