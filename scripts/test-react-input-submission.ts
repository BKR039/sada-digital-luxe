import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('=== TESTING REACT 19 FORM SUBMISSION WITH NATIVE VALUE SETTER ===');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));

  await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1200));

  // 1. Click Quick Match
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    cards.find(c => (c as HTMLElement).innerText.includes('Quick recommendation'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 600));

  // 2. Q1: Social Media Growth
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Social Media Growth'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 3. Q2: Content + Ads
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Content + Ads'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // 4. Q3: 2 000+ TND
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('2 000+ TND'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Recommendation'))?.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 5. Proceed to Contact Details Form
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Proceed with this Package'))?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 6. Fill using Native Value Setter to properly update React 19 controlled states
  const testEmail = `qa.verified.${Date.now()}@sada-luxury.agency`;
  console.log('Filling form with test email:', testEmail);

  await page.evaluate(`(email) => {
    var form = document.querySelector('form');
    if (!form) return;
    var inputs = Array.from(form.querySelectorAll('input'));
    
    var setVal = function(el, v) {
      var proto = window.HTMLInputElement.prototype;
      var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, v);
      } else {
        el.value = v;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    if (inputs[0]) setVal(inputs[0], 'Boubakar QA Lead');
    if (inputs[1]) setVal(inputs[1], 'Le Gourmet Luxury Diner');
    if (inputs[2]) setVal(inputs[2], '+216 98 123 456');
    if (inputs[3]) setVal(inputs[3], email);
  }`, testEmail);

  await new Promise(r => setTimeout(r, 600));

  // 7. Click Confirm & Send Request
  console.log('Submitting inquiry form...');
  await page.evaluate(() => {
    const subBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Confirm & Send Request'));
    if (subBtn) subBtn.click();
  });

  // Wait 4s for network request & toast/transition
  await new Promise(r => setTimeout(r, 4500));

  await page.screenshot({ path: 'scripts/e2e_real_success.png' });
  console.log('Saved screenshot: scripts/e2e_real_success.png');

  const screenText = await page.evaluate(() => document.body.innerText);
  console.log('\nFINAL SCREEN TEXT:');
  console.log(screenText.substring(0, 500));

  // 8. Query database
  const { data: leads, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('email', testEmail);

  console.log('\nDATABASE QUERY RESULT:');
  console.log('Count:', leads?.length, 'Error:', error?.message);
  if (leads && leads.length > 0) {
    console.log('SUCCESS! LEAD PERSISTED IN DATABASE:');
    console.log('ID:', leads[0].id);
    console.log('NAME:', leads[0].name);
    console.log('BUSINESS:', leads[0].business_name);
    console.log('SERVICE:', leads[0].service);
    console.log('STATUS:', leads[0].status);
    console.log('PATH TAKEN:', leads[0].path_taken);
    console.log('DISCOVERY DATA:', JSON.stringify(leads[0].discovery_data).substring(0, 150));
  }

  await browser.close();
}

run().catch(console.error);
