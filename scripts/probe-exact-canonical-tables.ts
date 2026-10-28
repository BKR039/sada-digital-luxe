import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtfkzabiscyleztypqks.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zmt6YWJpc2N5bGV6dHlwcWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwODg2NzQsImV4cCI6MjEwMDY2NDY3NH0.3lIvgQsvAS9n7z5ImDFcW0BuIvJtad3ZaKL5XifYXAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REAL_TABLES = [
  'profiles',
  'user_roles',
  'team_members',
  'clients',
  'client_projects',
  'project_tasks',
  'project_activity',
  'task_handoffs',
  'client_communication_logs',
  'work_sessions',
  'client_deliverables',
  'production_bookings',
  'contact_submissions',
  'deals',
  'packages',
  'package_categories',
  'package_catalog',
  'package_addons',
  'financial_accounts',
  'invoices',
  'sponsoring_campaigns',
  'sales_commissions',
  'financial_closing_periods',
  'expense_categories',
  'subscriptions',
  'salary_records',
  'salary_payments',
  'salary_requests',
  'expense_transactions',
  'income_transactions',
  'notifications',
  'notification_preferences',
  'system_audit_logs',
  'account_audit_logs',
  'financial_audit_logs',
  'social_reels',
  'blog_posts',
  'products',
  'testimonials',
  'projects',
  'site_settings'
];

async function probeExactTables() {
  console.log('=== PROBING EXACT CANONICAL SCHEMA AS SUPER ADMIN ===');
  const auth = await supabase.auth.signInWithPassword({
    email: 'sec.admin@sada.agency',
    password: 'AdminPassword123!'
  });

  if (auth.error) {
    console.error('Super admin login failed:', auth.error.message);
    return;
  }

  const results: any[] = [];

  for (const table of REAL_TABLES) {
    try {
      const { data, error, count } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      results.push({
        table,
        accessible: !error,
        count: count ?? (data ? data.length : 0),
        error: error?.message || null,
        sampleKeys: data && data[0] ? Object.keys(data[0]) : []
      });
    } catch (e: any) {
      results.push({
        table,
        accessible: false,
        count: null,
        error: e.message,
        sampleKeys: []
      });
    }
  }

  console.log('\n--- EXACT SCHEMA AUDIT TABLE SUMMARY ---');
  for (const r of results) {
    console.log(`${r.accessible ? '✓' : '✗'} [${r.table.padEnd(28)}]: count=${String(r.count).padStart(4)} | error=${r.error || 'none'}`);
    if (r.sampleKeys.length > 0) {
      console.log(`    Columns: ${r.sampleKeys.slice(0, 8).join(', ')} ... (${r.sampleKeys.length} cols)`);
    }
  }

  fs.writeFileSync('scripts/audit_exact_tables_report.json', JSON.stringify(results, null, 2));
}

probeExactTables().catch(console.error);
