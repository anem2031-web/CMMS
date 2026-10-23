import puppeteer from "puppeteer-core";

const [username = "RED3", path = "/", ...clickTexts] = process.argv.slice(2);
const password = username.startsWith("RED") ? "A1234567" : "ADMIN33333";
const baseUrl = "http://localhost:4001";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("console", message => {
    if (["error", "warning"].includes(message.type())) browserErrors.push(`console:${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", error => browserErrors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", request => browserErrors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText || "unknown"}`));
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30_000 });
  const usernameInput = 'input[placeholder="اسم المستخدم"]';
  if (await page.$(usernameInput)) {
    await page.type(usernameInput, username);
    await page.type('input[placeholder="كلمة المرور"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('input[placeholder="اسم المستخدم"]'), { timeout: 30_000 });
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }

  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise(resolve => setTimeout(resolve, 5_000));
  for (const clickText of clickTexts) {
    const candidates = await page.$$("button, a, [role=button]");
    let clicked = false;
    for (const candidate of candidates) {
      const text = await candidate.evaluate(element => element.textContent?.trim() || "");
      const matches = clickText.endsWith("*") ? text.startsWith(clickText.slice(0, -1)) : text === clickText;
      if (!matches) continue;
      await candidate.click();
      clicked = true;
      break;
    }
    if (!clicked) browserErrors.push(`action: element not found for exact text: ${clickText}`);
    await new Promise(resolve => setTimeout(resolve, 4_000));
  }
  console.log(JSON.stringify({
    username,
    url: page.url(),
    title: await page.title(),
    body: (await page.evaluate(() => document.body.innerText)).slice(0, 20_000),
    inputs: await page.evaluate(() => [...document.querySelectorAll("input")].map(input => ({
      type: input.type,
      name: input.name,
      value: input.value,
      placeholder: input.placeholder,
    }))),
    buttons: await page.evaluate(() => [...document.querySelectorAll("button")].map(button => ({
      text: button.innerText.trim(),
      disabled: button.disabled,
    }))),
    links: await page.evaluate(() => [...document.querySelectorAll("a")].map(link => ({
      text: link.innerText.trim(),
      href: link.getAttribute("href"),
    })).filter(link => link.text || link.href)),
    browserErrors,
  }, null, 2));
} finally {
  await browser.close();
}
