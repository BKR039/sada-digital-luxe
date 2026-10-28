import puppeteer from "puppeteer-core";
import path from "path";

async function capturePricing() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });

  console.log("Navigating to http://localhost:3001/pricing...");
  await page.goto("http://localhost:3001/pricing", { waitUntil: "networkidle2" });
  await page.waitForSelector(".sada-pricing-card", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Capture desktop
  const desktopPath = path.resolve(process.cwd(), "scripts/pricing_desktop_qa.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log("Saved desktop screenshot to:", desktopPath);

  // Check the cards and badges
  const badgeInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".sada-pricing-card"));
    return cards.map((card, i) => {
      const cardRect = card.getBoundingClientRect();
      const badge = card.querySelector('[class*="PricingCardBadge"], div[class*="rounded-full"][class*="uppercase"]');
      const badgeRect = badge ? badge.getBoundingClientRect() : null;
      const title = card.querySelector("h3")?.innerText;
      return {
        index: i,
        title,
        cardWidth: cardRect.width,
        badgeFound: !!badge,
        badgeText: badge?.textContent,
        badgeOverflowRight: badgeRect ? badgeRect.right > cardRect.right : false,
        badgeRightMargin: badgeRect ? cardRect.right - badgeRect.right : null,
      };
    });
  });

  console.log("Card & Badge audit:", JSON.stringify(badgeInfo, null, 2));

  // Capture tablet (768px)
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise((r) => setTimeout(r, 500));
  const tabletPath = path.resolve(process.cwd(), "scripts/pricing_tablet_qa.png");
  await page.screenshot({ path: tabletPath, fullPage: false });
  console.log("Saved tablet screenshot to:", tabletPath);

  // Capture mobile (390px)
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 500));
  const mobilePath = path.resolve(process.cwd(), "scripts/pricing_mobile_qa.png");
  await page.screenshot({ path: mobilePath, fullPage: false });
  console.log("Saved mobile screenshot to:", mobilePath);

  await browser.close();
}

capturePricing().catch((err) => {
  console.error("Failed to capture pricing:", err);
  process.exit(1);
});
