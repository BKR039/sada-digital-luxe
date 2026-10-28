import puppeteer from 'puppeteer-core';

async function checkAnonymousAdmin() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:3000/admin as anonymous...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
  
  console.log('Immediate URL:', page.url());
  console.log('Immediate text length:', (await page.evaluate(() => document.body.innerText)).length);
  
  // Wait 3 seconds to see if client redirect happens
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('After 3s URL:', page.url());
  console.log('After 3s text:', (await page.evaluate(() => document.body.innerText.substring(0, 200))));
  
  await browser.close();
}

checkAnonymousAdmin().catch(console.error);
