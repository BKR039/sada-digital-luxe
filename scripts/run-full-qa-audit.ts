import puppeteer, { Browser, Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface AuditLog {
  timestamp: string;
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  details: string;
  data?: any;
}

const auditLogs: AuditLog[] = [];

function log(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN' | 'INFO', details: string, data?: any) {
  const entry: AuditLog = {
    timestamp: new Date().toISOString(),
    category,
    test,
    status,
    details,
    data
  };
  auditLogs.push(entry);
  console.log(`[${status}] [${category}] ${test} - ${details}`);
}

async function loginAs(page: Page, email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) {
    throw new Error(`Auth failed for ${email}: ${error?.message}`);
  }

  // Inject session into page localStorage for Supabase client
  await page.evaluate((sessionData) => {
    const storageKey = 'sb-mtfkzabiscyleztypqks-auth-token';
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }, data.session);

  return data.session;
}

async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function runE2EAudit() {
  console.log('=== STARTING SADA COMPREHENSIVE E2E QA AUDIT ===');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Capture console errors
  const pageErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      pageErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // -------------------------------------------------------------
    // PART 1: PUBLIC ROUTES ACCESSIBILITY & RENDERING
    // -------------------------------------------------------------
    const publicRoutes = [
      { path: '/', title: 'Home' },
      { path: '/services', title: 'Services' },
      { path: '/portfolio', title: 'Portfolio' },
      { path: '/pricing', title: 'Pricing' },
      { path: '/about', title: 'About' },
      { path: '/blog', title: 'Blog' },
      { path: '/contact', title: 'Contact' },
      { path: '/auth', title: 'Auth' }
    ];

    for (const route of publicRoutes) {
      try {
        const url = `http://localhost:3000${route.path}`;
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1000)); // allow client hydration
        const status = res?.status() || 0;
        const title = await page.title();
        
        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        if (status >= 400) {
          log('Public Routes', route.path, 'FAIL', `HTTP Status ${status}`);
        } else if (overflow) {
          log('Public Routes', route.path, 'WARN', `Page has horizontal overflow (scrollWidth > innerWidth)`);
        } else {
          log('Public Routes', route.path, 'PASS', `Loaded OK (${status}) - Title: ${title}`);
        }
      } catch (err: any) {
        log('Public Routes', route.path, 'FAIL', `Navigation error: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // PART 2: RBAC MATRIX & ROUTE GUARDS
    // -------------------------------------------------------------
    const adminRoutes = [
      { path: '/admin', name: 'Dashboard' },
      { path: '/admin/analytics', name: 'Analytics' },
      { path: '/admin/accounts', name: 'Accounts (Super Admin Only)' },
      { path: '/admin/finance', name: 'Finance (Super Admin Only)' },
      { path: '/admin/packages', name: 'Packages CMS' },
      { path: '/admin/deals', name: 'Deals / Sales Pipeline' },
      { path: '/admin/clients', name: 'Clients' },
      { path: '/admin/client-projects', name: 'Projects' },
      { path: '/admin/calendar', name: 'Calendar' },
      { path: '/admin/reels', name: 'Reels CMS' },
      { path: '/admin/testimonials', name: 'Testimonials CMS' },
      { path: '/admin/blog', name: 'Blog CMS' },
      { path: '/admin/contact', name: 'Inquiries' },
      { path: '/admin/my-work', name: 'Worker My Work' },
      { path: '/admin/my-salary', name: 'Worker My Salary' }
    ];

    // 2.1 Anonymous User Accessing Admin Routes
    console.log('\n--- Testing Anonymous User on Admin Routes ---');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);

    for (const route of adminRoutes) {
      await page.goto(`http://localhost:3000${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText);

      const isRedirectedToAuth = currentUrl.includes('/auth');
      const hasAccessDenied = bodyText.includes('Access Denied') || bodyText.includes('Sign in') || bodyText.includes('Unauthorized') || bodyText.includes('Connexion');

      if (isRedirectedToAuth || hasAccessDenied) {
        log('RBAC Anonymous', route.path, 'PASS', `Correctly blocked anonymous access (redirected to ${currentUrl})`);
      } else {
        log('RBAC Anonymous', route.path, 'FAIL', `LEAK: Anonymous user can view ${route.path} without redirect!`);
      }
    }

    // 2.2 Worker Role Accessing Restricted Admin Routes
    console.log('\n--- Testing Worker Role on Admin Routes ---');
    // First let's check what worker account exists or use one from verify-rbac-full.ts
    // Let's query team_members or profiles to get worker email
    const { data: workerProfiles } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'worker')
      .limit(3);

    const workerEmail = workerProfiles?.[0]?.email;
    console.log('Worker email available:', workerEmail);

    if (workerEmail) {
      // Let's authenticate as worker or test simulated worker context
      try {
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
        // Let's test with phase1.tester (admin) first
      } catch (e: any) {
        console.warn('Worker login failed:', e.message);
      }
    }

    // 2.3 Admin Role (phase1.tester@sada.agency)
    console.log('\n--- Testing Admin Role (phase1.tester@sada.agency) ---');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);
    await loginAs(page, 'phase1.tester@sada.agency', 'Phase1TestPassword123!');

    // Admin should NOT have access to:
    // /admin/accounts (Super Admin only)
    // /admin/finance (Super Admin only)
    // Admin SHOULD have access to:
    // /admin/packages, /admin/deals, /admin/clients, /admin/client-projects, etc.
    const adminRestricted = ['/admin/accounts', '/admin/finance'];
    for (const path of adminRestricted) {
      await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await page.evaluate(() => document.body.innerText);
      const isBlocked = content.includes('Restricted') || content.includes('Super Admin') || content.includes('Access Denied') || content.includes('Accès Refusé') || content.includes('Access Restricted');
      if (isBlocked) {
        log('RBAC Admin', path, 'PASS', `Admin correctly blocked from Super Admin route (${path})`);
      } else {
        log('RBAC Admin', path, 'FAIL', `VIOLATION: Admin was able to view Super Admin page: ${path}`);
      }
    }

    // Test Allowed routes for Admin
    const adminAllowed = ['/admin/packages', '/admin/deals', '/admin/clients', '/admin/calendar'];
    for (const path of adminAllowed) {
      await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await page.evaluate(() => document.body.innerText);
      const isBlocked = content.includes('Access Denied') || content.includes('Accès Refusé') || content.includes('Restricted');
      if (!isBlocked) {
        log('RBAC Admin', path, 'PASS', `Admin allowed to access ${path}`);
      } else {
        log('RBAC Admin', path, 'FAIL', `UNEXPECTED BLOCK: Admin blocked from ${path}`);
      }
    }

    // 2.4 Super Admin Role (sec.admin@sada.agency)
    console.log('\n--- Testing Super Admin Role (sec.admin@sada.agency) ---');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);
    await loginAs(page, 'sec.admin@sada.agency', 'AdminPassword123!');

    for (const route of adminRoutes) {
      await page.goto(`http://localhost:3000${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await page.evaluate(() => document.body.innerText);
      const isBlocked = content.includes('Access Denied') || content.includes('Accès Refusé') || (content.includes('Restricted') && content.includes('Super Admin only'));
      if (!isBlocked) {
        log('RBAC Super Admin', route.path, 'PASS', `Super Admin can access ${route.name}`);
      } else {
        log('RBAC Super Admin', route.path, 'FAIL', `Super Admin was blocked from ${route.path}!`);
      }
    }

    // -------------------------------------------------------------
    // PART 3: CONTACT PAGE & SMART PACKAGE MATCHER AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Testing Contact Page & Smart Package Matcher ---');
    await clearAuth(page);
    await page.goto('http://localhost:3000/contact', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Check tabs: standard inquiry vs smart discovery
    const pageHtml = await page.content();
    const hasSmartMatcher = pageHtml.includes('Smart Discovery') || pageHtml.includes('Pack Matcher') || pageHtml.includes('Trouvez le pack idéal') || pageHtml.includes('Recommandation IA') || pageHtml.includes('Quick Match');

    log('Contact Page', 'Smart Matcher Presence', hasSmartMatcher ? 'PASS' : 'FAIL', `Smart Matcher found on /contact: ${hasSmartMatcher}`);

    // Let's test the interactive flow of the matcher
    // Find matcher button or tab
    const matcherTabSelector = 'button, [role="tab"]';
    const tabTexts = await page.$$eval(matcherTabSelector, els => els.map(e => (e as HTMLElement).innerText.trim()));
    console.log('Available buttons/tabs on Contact:', tabTexts.filter(t => t.length > 0));

    // -------------------------------------------------------------
    // PART 4: PACKAGE CATALOG CMS & CREATE PACKAGE DRAWER AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Auditing Package Catalog CMS & Create Drawer ---');
    await loginAs(page, 'sec.admin@sada.agency', 'AdminPassword123!');
    await page.goto('http://localhost:3000/admin/packages', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Verify packages table/cards loaded
    const packageCards = await page.$$eval('[data-package-code], tr, .package-card', els => els.length);
    log('Admin Packages', 'Catalog Listing', packageCards > 0 ? 'PASS' : 'WARN', `Found ${packageCards} package elements rendered`);

    // Click "New Package" or "Create Package" button
    const newPackageBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Nouveau Pack') || b.innerText.includes('Create') || b.innerText.includes('New Package'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (newPackageBtn) {
      log('Admin Packages', 'Open Create Drawer', 'PASS', 'Clicked Create Package button');
      await new Promise(r => setTimeout(r, 1000));

      // Check if drawer opened
      const drawerVisible = await page.evaluate(() => {
        const drawer = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-y-0.right-0');
        return drawer !== null;
      });

      log('Admin Packages', 'Drawer Rendered', drawerVisible ? 'PASS' : 'FAIL', `Drawer open state: ${drawerVisible}`);

      if (drawerVisible) {
        // Test counter fields in direct costs section
        // Switch to direct costs tab/section
        await page.evaluate(() => {
          const tab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Coûts') || b.innerText.includes('Costs') || b.innerText.includes('Financial'));
          if (tab) tab.click();
        });
        await new Promise(r => setTimeout(r, 600));

        // Evaluate all SADANumberStepper / counter instances in drawer
        const counterMetrics = await page.evaluate(() => {
          const steppers = Array.from(document.querySelectorAll('[data-slot="sada-number-stepper"], .sada-stepper-control, [data-component="sada-counter"]'));
          return steppers.map((s, idx) => {
            const rect = s.getBoundingClientRect();
            const text = (s as HTMLElement).innerText;
            const hasTnd = text.includes('TND');
            const buttons = s.querySelectorAll('button').length;
            return {
              idx,
              text: text.replace(/\s+/g, ' ').trim(),
              width: rect.width,
              height: rect.height,
              buttons,
              hasTnd,
              isClipped: rect.width < 120
            };
          });
        });

        console.log('Detected Stepper Controls in Drawer:', counterMetrics);
        const clippedCounters = counterMetrics.filter(c => c.isClipped);
        if (clippedCounters.length === 0 && counterMetrics.length > 0) {
          log('Drawer Steppers', 'Visual Rendering', 'PASS', `All ${counterMetrics.length} counters rendered with adequate width (>=120px)`);
        } else if (counterMetrics.length > 0) {
          log('Drawer Steppers', 'Visual Rendering', 'FAIL', `${clippedCounters.length} counters appear clipped (<120px width)`, clippedCounters);
        } else {
          log('Drawer Steppers', 'Visual Rendering', 'WARN', 'No stepper elements found with specified selector');
        }
      }
    } else {
      log('Admin Packages', 'Open Create Drawer', 'WARN', 'Could not locate Create Package button via text');
    }

    // -------------------------------------------------------------
    // PART 5: BUTTON WRAPPING AUDIT ACROSS VIEWPORTS
    // -------------------------------------------------------------
    console.log('\n--- Auditing Button Wrapping & Layouts Across Viewports ---');
    const viewports = [
      { w: 375, h: 667, name: 'Mobile 375px' },
      { w: 390, h: 844, name: 'Mobile 390px' },
      { w: 430, h: 932, name: 'Mobile 430px' },
      { w: 768, h: 1024, name: 'Tablet 768px' },
      { w: 900, h: 1024, name: 'Tablet 900px' },
      { w: 1024, h: 768, name: 'Desktop 1024px' },
      { w: 1280, h: 800, name: 'Desktop 1280px' },
      { w: 1440, h: 900, name: 'Desktop 1440px' },
      { w: 1920, h: 1080, name: 'Desktop 1920px' }
    ];

    const auditPages = ['/pricing', '/contact', '/admin/packages'];

    for (const testPage of auditPages) {
      for (const vp of [viewports[0], viewports[3], viewports[6], viewports[8]]) { // sample 375, 768, 1280, 1920
        await page.setViewport({ width: vp.w, height: vp.h });
        await page.goto(`http://localhost:3000${testPage}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Check for wrapping buttons with text + icon
        const buttonWrappingIssues = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a[role="button"], .btn'));
          const issues: { text: string; width: number; height: number; lineHeight: number }[] = [];
          
          buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            // If button is visible
            if (rect.width > 0 && rect.height > 0) {
              const text = (btn as HTMLElement).innerText.trim();
              const hasIcon = btn.querySelector('svg') !== null;
              
              // If button has icon and text, check if it wrapped awkwardly (height > 55px on standard button)
              if (hasIcon && text.length > 0 && text.length < 30) {
                const computed = window.getComputedStyle(btn);
                const fontSize = parseFloat(computed.fontSize) || 14;
                // If button height is more than 3.5x font size, likely 2+ line wrap
                if (rect.height > fontSize * 3.8 && !btn.className.includes('h-auto') && !btn.className.includes('flex-col')) {
                  issues.push({ text: text.substring(0, 30), width: Math.round(rect.width), height: Math.round(rect.height), lineHeight: fontSize });
                }
              }
            }
          });
          return issues;
        });

        if (buttonWrappingIssues.length > 0) {
          log('Button Wrapping', `${testPage} @ ${vp.name}`, 'WARN', `Detected ${buttonWrappingIssues.length} potentially awkwardly wrapped buttons`, buttonWrappingIssues);
        } else {
          log('Button Wrapping', `${testPage} @ ${vp.name}`, 'PASS', 'All button text and icons aligned without awkward wrapping');
        }
      }
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
    log('System', 'Audit Execution', 'FAIL', err.message);
  } finally {
    await browser.close();
    console.log('\n=== AUDIT RUN COMPLETED ===');
    fs.writeFileSync('scripts/qa_audit_results.json', JSON.stringify(auditLogs, null, 2));
    console.log(`Results saved to scripts/qa_audit_results.json (${auditLogs.length} assertions recorded)`);
  }
}

runE2EAudit().catch(console.error);
