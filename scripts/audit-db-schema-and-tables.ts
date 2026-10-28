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

const CANDIDATE_TABLES = [
  'profiles',
  'team_members',
  'clients',
  'client_projects',
  'tasks',
  'calendar_events',
  'contact_submissions',
  'smart_discovery_submissions',
  'deals',
  'packages',
  'package_catalog',
  'financial_transactions',
  'invoices',
  'payments',
  'expenses',
  'salary_requests',
  'team_time_logs',
  'notifications',
  'notification_preferences',
  'audit_logs',
  'projects', // legacy
  'testimonials',
  'articles',
  'reels',
  'products',
  'deliverables'
];

async function runAudit() {
  console.log('=== PROBING DATABASE TABLES AS SUPER ADMIN ===');
  const auth = await supabase.auth.signInWithPassword({
    email: 'sec.admin@sada.agency',
    password: 'AdminPassword123!'
  });

  if (auth.error) {
    console.error('Super admin login failed:', auth.error.message);
    return;
  }

  console.log('Super Admin authenticated:', auth.data.user.id);

  const tableSummary: Record<string, { exists: boolean; count: number | null; error: string | null; sampleCols: string[] }> = {};

  for (const t of CANDIDATE_TABLES) {
    try {
      const { data, error, count } = await (supabase as any)
        .from(t)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        tableSummary[t] = {
          exists: !error.message.includes('does not exist') && !error.message.includes('relation'),
          count: null,
          error: error.message,
          sampleCols: []
        };
      } else {
        tableSummary[t] = {
          exists: true,
          count: count ?? (data ? data.length : 0),
          error: null,
          sampleCols: data && data.length > 0 ? Object.keys(data[0]) : []
        };
      }
    } catch (e: any) {
      tableSummary[t] = {
        exists: false,
        count: null,
        error: e.message,
        sampleCols: []
      };
    }
  }

  console.log('\n--- DATABASE TABLES AUDIT RESULTS ---');
  for (const [name, info] of Object.entries(tableSummary)) {
    console.log(`${info.exists ? '✓' : '✗'} [${name}]: exists=${info.exists}, count=${info.count}, error=${info.error || 'none'}`);
    if (info.sampleCols.length > 0) {
      console.log(`    Columns (${info.sampleCols.length}): ${info.sampleCols.slice(0, 10).join(', ')}${info.sampleCols.length > 10 ? '...' : ''}`);
    }
  }
}

runAudit().catch(console.error);
