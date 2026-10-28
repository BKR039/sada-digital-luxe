import puppeteer from "puppeteer-core";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/admin/client-workspaces/f760aebb-99e5-4881-93b2-431b9a65b450", {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 2000));

  const sections = [
    { id: "overview-section", label: "Overview" },
    { id: "services-section", label: "Services" },
    { id: "delivery-section", label: "Delivery" },
    { id: "team-section", label: "Team" },
    { id: "financial-section", label: "Financial" },
    { id: "memory-section", label: "Memory" },
    { id: "history-section", label: "History" },
  ];

  for (const s of sections) {
    await page.evaluate((targetLabel) => {
      const btns = Array.from(document.querySelectorAll(".sticky button"));
      const btn = btns.find((b) => b.textContent?.includes(targetLabel));
      if (btn) (btn as HTMLElement).click();
    }, s.label);

    await new Promise((r) => setTimeout(r, 1200));

    const data = await page.evaluate((secId) => {
      const main = document.querySelector("#sada-admin-main");
      const stickyNav = document.querySelector(".sticky");
      const sec = document.getElementById(secId);
      const h2 = sec?.querySelector("h2");

      const navR = stickyNav ? stickyNav.getBoundingClientRect() : null;
      const h2R = h2 ? h2.getBoundingClientRect() : null;
      const secR = sec ? sec.getBoundingClientRect() : null;

      return {
        mainScrollTop: main ? main.scrollTop : 0,
        navBottom: navR ? navR.bottom : 0,
        navHeight: navR ? navR.height : 0,
        h2Top: h2R ? h2R.top : 0,
        h2Bottom: h2R ? h2R.bottom : 0,
        secTop: secR ? secR.top : 0,
        gapBetweenNavAndH2: h2R && navR ? h2R.top - navR.bottom : 0,
      };
    }, s.id);

    console.log(`${s.label} (${s.id}): gap=${data.gapBetweenNavAndH2.toFixed(1)}px (navBottom=${data.navBottom.toFixed(1)}, h2Top=${data.h2Top.toFixed(1)}, secTop=${data.secTop.toFixed(1)})`);
  }

  await browser.close();
}

main().catch(console.error);
