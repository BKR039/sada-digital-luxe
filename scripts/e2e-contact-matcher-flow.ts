import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testContactMatcherFlow() {
  console.log('=== TESTING REAL USER JOURNEY ON /contact ===');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Open /contact
  console.log('1. Navigating to /contact...');
  await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));

  // Verify Hero Title
  const heroTitle = await page.$eval('h1', el => el.innerText);
  console.log('Hero Title found:', heroTitle);

  // 2. Click "Quick recommendation" (Quick Match)
  console.log('2. Clicking "Quick recommendation" option...');
  const clickedQuick = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
    const quickCard = cards.find(c => (c as HTMLElement).innerText.includes('Quick recommendation') || (c as HTMLElement).innerText.includes('توصية سريعة'));
    if (quickCard) {
      (quickCard as HTMLElement).click();
      return true;
    }
    return false;
  });
  console.log('Clicked quick match card:', clickedQuick);
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot of Step 1
  await page.screenshot({ path: 'scripts/e2e_quick_step1.png' });
  console.log('Saved screenshot: scripts/e2e_quick_step1.png');

  // 3. Step 1: Select Goal "Social Media Growth"
  console.log('3. Selecting "Social Media Growth"...');
  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('div.cursor-pointer, button'));
    const opt = options.find(o => (o as HTMLElement).innerText.includes('Social Media Growth') || (o as HTMLElement).innerText.includes('نمو الحسابات'));
    if (opt) (opt as HTMLElement).click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click Continue / Next
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextBtn = buttons.find(b => b.innerText.includes('Continue') || b.innerText.includes('التالي'));
    if (nextBtn) nextBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 4. Step 2: Select Need "Content + Ads"
  console.log('4. Selecting "Content + Ads"...');
  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('div.cursor-pointer, button'));
    const opt = options.find(o => (o as HTMLElement).innerText.includes('Content + Ads') || (o as HTMLElement).innerText.includes('محتوى + إعلانات'));
    if (opt) (opt as HTMLElement).click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click Continue / Next
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextBtn = buttons.find(b => b.innerText.includes('Continue') || b.innerText.includes('التالي'));
    if (nextBtn) nextBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 5. Step 3: Select Budget "2 000+ TND" (Persona A / Premium content)
  console.log('5. Selecting "2 000+ TND"...');
  await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('div.cursor-pointer, button'));
    const opt = options.find(o => (o as HTMLElement).innerText.includes('2 000+ TND') || (o as HTMLElement).innerText.includes('أكثر من 2 000'));
    if (opt) (opt as HTMLElement).click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click "Show Best Fit Recommendation"
  console.log('6. Submitting answers to Matcher Engine...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const calcBtn = buttons.find(b => b.innerText.includes('Recommendation') || b.innerText.includes('توصية'));
    if (calcBtn) calcBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Take screenshot of Recommendation View
  await page.screenshot({ path: 'scripts/e2e_recommendation.png' });
  console.log('Saved screenshot: scripts/e2e_recommendation.png');

  // 6. Inspect Recommendation Result
  const recData = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3, [data-slot="sada-badge"]')).map(el => (el as HTMLElement).innerText);
    const scoreBadge = document.querySelector('[data-slot="sada-badge"]')?.textContent;
    const bodyText = document.body.innerText;
    return {
      scoreBadge,
      headings,
      hasScore: bodyText.includes('%') || bodyText.includes('Match'),
      bodySnippet: bodyText.substring(0, 800)
    };
  });
  console.log('Recommendation View data:', recData);

  // 7. Click Continue to Contact Details Form
  console.log('7. Proceeding to Contact Details form...');
  const clickedProceed = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const proceedBtn = buttons.find(b => b.innerText.includes('Proceed with this Package') || b.innerText.includes('اعتماد الباقة'));
    if (proceedBtn) {
      proceedBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Proceed button:', clickedProceed);
  await new Promise(r => setTimeout(r, 1500));

  // Take screenshot of Contact Form
  await page.screenshot({ path: 'scripts/e2e_contact_form.png' });
  console.log('Saved screenshot: scripts/e2e_contact_form.png');

  // 8. Fill realistic contact information
  console.log('8. Filling contact form fields...');
  const testEmail = `qa.audit.${Date.now()}@sada-test.agency`;
  await page.evaluate((email) => {
    const form = document.querySelector('form');
    if (!form) return;
    const inputs = Array.from(form.querySelectorAll('input'));
    if (inputs[0]) {
      inputs[0].value = 'Boubakar QA Lead';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputs[1]) {
      inputs[1].value = 'Le Gourmet Luxury Diner';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputs[2]) {
      inputs[2].value = '+216 98 123 456';
      inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[2].dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (inputs[3]) {
      inputs[3].value = email;
      inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[3].dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, testEmail);

  await new Promise(r => setTimeout(r, 600));

  // 9. Submit the form
  console.log('9. Submitting Inquiry...');
  const submitted = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[type="submit"], button'));
    const subBtn = buttons.find(b => b.innerText.includes('Confirm & Send Request') || b.innerText.includes('تأكيد وإرسال الطلب'));
    if (subBtn) {
      subBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Submit button:', submitted);
  await new Promise(r => setTimeout(r, 4000));

  // Take screenshot of Success screen
  await page.screenshot({ path: 'scripts/e2e_success_screen.png' });
  console.log('Saved screenshot: scripts/e2e_success_screen.png');

  const successText = await page.evaluate(() => document.body.innerText);
  const isSuccess = successText.includes('Thank you') || successText.includes('شكراً') || successText.includes('received') || successText.includes('Success') || successText.includes('Confirmed') || successText.includes('تم استلام طلبك');
  console.log('Success confirmation detected:', isSuccess);

  // 10. Check Database Persistence
  console.log('10. Querying Supabase for persisted submission...');
  const { data: leadDb, error: leadErr } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('email', testEmail);

  console.log('Database verification:', leadDb && leadDb.length > 0 ? 'FOUND IN DB!' : 'NOT FOUND IN contact_submissions', leadErr?.message || '');

  await browser.close();
  console.log('=== CONTACT MATCHER JOURNEY AUDIT COMPLETE ===');
}

testContactMatcherFlow().catch(console.error);
