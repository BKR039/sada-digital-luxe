import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));

  await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1000));

  // Click Quick Match
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    cards.find(c => (c as HTMLElement).innerText.includes('Quick recommendation'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 600));

  // Q1: Social Media Growth
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Social Media Growth'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Q2: Content + Ads
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('Content + Ads'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Continue'))?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Q3: 2 000+ TND
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('div.cursor-pointer, button')).find(o => (o as HTMLElement).innerText.includes('2 000+ TND'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Recommendation'))?.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Recommendation -> Proceed
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Proceed with this Package'))?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Real typing into form inputs
  console.log('Typing name...');
  await page.type('input[placeholder*="Smith"]', 'Boubakar QA Lead');
  console.log('Typing business name...');
  await page.type('input[placeholder*="Fleurie"]', 'Le Gourmet Luxury Diner');
  console.log('Typing phone...');
  await page.type('input[type="tel"]', '+216 98 123 456');
  const testEmail = `real.human.lead.${Date.now()}@sada.media`;
  console.log('Typing email:', testEmail);
  await page.type('input[type="email"]', testEmail);

  // Click Confirm & Send Request
  console.log('Clicking Confirm & Send Request button...');
  await page.evaluate(() => {
    const subBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Confirm & Send Request'));
    if (subBtn) subBtn.click();
  });

  // Wait 4s for network request & toast/transition
  await new Promise(r => setTimeout(r, 4000));

  const screenText = await page.evaluate(() => document.body.innerText);
  console.log('\nFINAL SCREEN TEXT:');
  console.log(screenText.substring(0, 500));

  // Query database
  const { data: leads, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('email', testEmail);

  console.log('\nDATABASE QUERY RESULT:');
  console.log('Count:', leads?.length, 'Error:', error?.message);
  if (leads && leads.length > 0) {
    console.log('PERSISTED LEAD ID:', leads[0].id);
    console.log('SERVICE:', leads[0].service);
    console.log('STATUS:', leads[0].status);
    console.log('DISCOVERY DATA:', JSON.stringify(leads[0].discovery_data).substring(0, 150));
  }

  await browser.close();
}

run().catch(console.error);
