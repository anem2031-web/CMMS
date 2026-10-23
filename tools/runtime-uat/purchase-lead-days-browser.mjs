import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  await page.goto("http://localhost:4001", { waitUntil: "networkidle2", timeout: 30_000 });
  await page.type('input[placeholder="اسم المستخدم"]', "RED3");
  await page.type('input[placeholder="كلمة المرور"]', "A1234567");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('input[placeholder="اسم المستخدم"]'), { timeout: 30_000 });
  await page.goto("http://localhost:4001/purchase-orders/new", { waitUntil: "networkidle2", timeout: 30_000 });
  await new Promise(resolve => setTimeout(resolve, 4_000));

  const values = async () => page.evaluate(() => ({
    duration: document.querySelector('input[type="number"]')?.value,
    needDate: document.querySelector('input[type="date"]')?.value,
  }));
  const initial = await values();

  await page.evaluate(() => {
    const input = document.querySelector('input[type="date"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "2026-10-25");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const afterDate = await values();

  const durationInput = await page.$('input[type="number"]');
  await durationInput.click({ clickCount: 3 });
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.type("6");
  await page.keyboard.press("Tab");
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const afterDuration = await values();

  console.log(JSON.stringify({ initial, afterDate, afterDuration }, null, 2));
} finally {
  await browser.close();
}
