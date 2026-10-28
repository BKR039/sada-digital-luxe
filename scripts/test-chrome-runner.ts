import puppeteer from 'puppeteer-core';

async function testChrome() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  const title = await page.title();
  console.log('Page Title:', title);
  await browser.close();
}

testChrome().catch(console.error);
