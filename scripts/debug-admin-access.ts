import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminAccountAccess() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  
  // 1. Sign in with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'phase1.tester@sada.agency',
    password: 'Phase1TestPassword123!'
  });
  if (error || !data.session) {
    console.error('Login error:', error);
    await browser.close();
    return;
  }
  
  console.log('Logged in user ID:', data.user.id);

  // Check profile role in DB
  const { data: prof } = await supabase.from('profiles').select('id, role').eq('id', data.user.id).single();
  console.log('Database profile role:', prof);

  // Navigate to root to set localStorage
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    localStorage.setItem('sb-mtfkzabiscyleztypqks-auth-token', JSON.stringify(session));
  }, data.session);

  // Navigate to /admin/accounts
  console.log('\nNavigating to /admin/accounts...');
  await page.goto('http://localhost:3000/admin/accounts', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  
  const textAccounts = await page.evaluate(() => document.body.innerText);
  console.log('Accounts Page Text (first 300 chars):');
  console.log(textAccounts.substring(0, 300));

  // Navigate to /admin/finance
  console.log('\nNavigating to /admin/finance...');
  await page.goto('http://localhost:3000/admin/finance', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const textFinance = await page.evaluate(() => document.body.innerText);
  console.log('Finance Page Text (first 300 chars):');
  console.log(textFinance.substring(0, 300));

  await browser.close();
}

checkAdminAccountAccess().catch(console.error);
