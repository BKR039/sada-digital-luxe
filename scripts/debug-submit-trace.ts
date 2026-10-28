import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
  page.on('framenavigated', f => console.log('NAVIGATED:', f.url()));

  await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));
  
  // Click Quick Match
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    (cards.find(c => (c as HTMLElement).innerText.includes('Quick recommendation')) as HTMLElement)?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  // Q1
  await page.evaluate(() => {
    (Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Social Media Growth')) as HTMLElement)?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Q2
  await page.evaluate(() => {
    (Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Content + Ads')) as HTMLElement)?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Q3
  await page.evaluate(() => {
    (Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('2 000+ TND')) as HTMLElement)?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Recommendation'))?.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Proceed
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Proceed with this Package'))?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Fill form
  const emailVal = 'debug.trace.' + Date.now() + '@sada.agency';
  await page.evaluate(`(email) => {
    var form = document.querySelector('form');
    var inputs = Array.from(form.querySelectorAll('input'));
    var setVal = function(el, v) {
      var proto = window.HTMLInputElement.prototype;
      var d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d && d.set) d.set.call(el, v);
      else el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (inputs[0]) setVal(inputs[0], 'Boubakar QA Lead');
    if (inputs[1]) setVal(inputs[1], 'Le Gourmet Luxury Diner');
    if (inputs[2]) setVal(inputs[2], '+216 98 123 456');
    if (inputs[3]) setVal(inputs[3], email);
  }`, emailVal);
  await new Promise(r => setTimeout(r, 500));

  console.log('--- READY TO CLICK SUBMIT ---');
  // Click submit
  await page.evaluate(() => {
    const subBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Confirm & Send Request'));
    console.log('Button found:', !!subBtn);
    if (subBtn) subBtn.click();
  });

  await new Promise(r => setTimeout(r, 4000));
  console.log('Final URL:', page.url());
  await browser.close();
}

run().catch(console.error);
