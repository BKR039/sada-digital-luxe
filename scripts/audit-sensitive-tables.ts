import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env');
const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function listPolicies() {
  await client.auth.signInWithPassword({
    email: 'qa.superadmin@sada.agency',
    password: 'SuperAdminPassword123!'
  });

  // Query pg_policies via RPC or test sensitive tables
  const sensitiveTables = [
    "clients",
    "client_projects",
    "project_tasks",
    "deals",
    "invoices",
    "sales_commissions",
    "salary_records",
    "salary_payments",
    "salary_requests",
    "work_sessions",
    "expense_transactions",
    "income_transactions",
    "business_rules",
    "business_rule_versions",
    "service_commitments",
    "workflow_templates",
    "workflow_stages",
    "security_alerts",
    "system_audit_logs",
    "account_audit_logs",
    "financial_audit_logs"
  ];

  console.log(`Auditing ${sensitiveTables.length} sensitive tables for PostgREST accessibility...`);

  const workerClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  await workerClient.auth.signInWithPassword({
    email: 'adv.target.test@sada.agency',
    password: 'AdvTargetPass2026!#'
  });

  console.log("\nAuditing 21 sensitive tables with target account (currently active session)...");
  for (const table of sensitiveTables) {
    const { data, error, status } = await workerClient.from(table).select("*").limit(1);
    console.log(`[ACTIVE] ${table}: status=${status}, rows=${data?.length ?? 0}, err=${error?.message || 'none'}`);
  }
}

listPolicies();
