import puppeteer from "puppeteer-core";

async function inspectPricing() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/pricing?lang=ar", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  const overflowInfo = await page.evaluate(() => {
    const wideElements: any[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 5 || rect.left < -5 || el.scrollWidth > window.innerWidth + 5) {
        wideElements.push({
          tag: el.tagName,
          id: el.id,
          className: (el as HTMLElement).className?.toString().substring(0, 100),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          rectRight: rect.right,
          rectLeft: rect.left,
        });
      }
    });

    const clippedBtns: any[] = [];
    document.querySelectorAll("button, a.btn").forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      if (btn.scrollWidth > rect.width + 1) {
        clippedBtns.push({
          text: btn.textContent?.trim(),
          scrollW: btn.scrollWidth,
          rectW: rect.width,
          className: (btn as HTMLElement).className?.toString().substring(0, 100),
        });
      }
    });

    return { wideElements: wideElements.slice(0, 15), clippedBtns };
  });

  console.log("Wide elements on Pricing:", JSON.stringify(overflowInfo.wideElements, null, 2));
  console.log("Clipped buttons:", JSON.stringify(overflowInfo.clippedBtns, null, 2));
  await browser.close();
}

inspectPricing().catch(console.error);
