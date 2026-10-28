import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const client = createClient(supabaseUrl, anonKey);

async function runAudit() {
  console.log("=== SADA OS LIVE DATABASE READINESS AUDIT (READ-ONLY) ===");
  console.log("Target URL:", supabaseUrl);

  const authRes = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authRes.error) {
    console.error("Auth error:", authRes.error.message);
    return;
  }
  console.log("Authenticated as:", authRes.data.user.email, "(ID:", authRes.data.user.id, ")");

  const tableList = [
    "profiles",
    "user_roles",
    "user_module_permissions",
    "team_members",
    "clients",
    "client_projects",
    "project_tasks",
    "client_deliverables",
    "production_bookings",
    "packages",
    "package_catalog",
    "package_categories",
    "package_addons",
    "workflow_templates",
    "workflow_stages",
    "contact_submissions",
    "projects",
    "social_reels",
    "blog_posts",
    "products",
    "testimonials",
    "notifications",
    "push_subscriptions",
    "deals",
    "sales_commissions",
    "financial_accounts",
    "income_transactions",
    "expense_transactions",
    "invoices",
    "sponsoring_campaigns",
    "salary_records",
    "salary_requests",
    "financial_periods",
    "business_rules",
    "business_rule_versions",
    "system_audit_logs",
    "account_audit_logs",
    "security_sessions"
  ];

  console.log("\n--- TABLE ROW COUNTS ---");
  const counts: Record<string, number | string> = {};
  for (const table of tableList) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) {
      counts[table] = `ERROR: ${error.message}`;
    } else {
      counts[table] = count ?? 0;
    }
    console.log(`  ${table.padEnd(26)} : ${counts[table]}`);
  }

  // Inspect Clients Deep
  console.log("\n--- CLIENTS INVENTORY ---");
  const { data: clients } = await client.from("clients").select("id, name, status, client_type, monthly_package_price, created_at");
  console.log(`Total Clients: ${clients?.length || 0}`);
  
  // Group by name to find duplicates
  const nameMap = new Map<string, any[]>();
  for (const c of clients || []) {
    const norm = (c.name || "").trim().toLowerCase();
    if (!nameMap.has(norm)) nameMap.set(norm, []);
    nameMap.get(norm)!.push(c);
  }

  console.log("\nDuplicate Client Names:");
  for (const [norm, group] of nameMap.entries()) {
    if (group.length > 1) {
      console.log(`  "${norm}" (${group.length} records):`);
      for (const item of group) {
        console.log(`    - ID: ${item.id} | Status: ${item.status} | Pkg: ${item.monthly_package_price} | Created: ${item.created_at}`);
      }
    }
  }

  // Inspect Projects (Case studies vs Client projects)
  console.log("\n--- CLIENT PROJECTS (CRM) ---");
  const { data: cProjects } = await client.from("client_projects").select("id, name, client_id, status, created_at");
  console.log(`Total Client Projects: ${cProjects?.length || 0}`);
  const cpNameMap = new Map<string, any[]>();
  for (const p of cProjects || []) {
    const norm = (p.name || "").trim().toLowerCase();
    if (!cpNameMap.has(norm)) cpNameMap.set(norm, []);
    cpNameMap.get(norm)!.push(p);
  }
  for (const [norm, group] of cpNameMap.entries()) {
    if (group.length > 1) {
      console.log(`  Duplicate CRM Project "${norm}" (${group.length} records):`);
      for (const item of group) {
        console.log(`    - ID: ${item.id} | Client: ${item.client_id} | Status: ${item.status}`);
      }
    }
  }

  // Inspect Public CMS Tables
  console.log("\n--- CMS CONTENT COUNTS & SAMPLES ---");
  const { data: cmsProjects } = await client.from("projects").select("id, title, published");
  console.log(`Public Projects (Case Studies): ${cmsProjects?.length || 0} (${cmsProjects?.filter(p => p.published).length || 0} published)`);

  const { data: cmsReels } = await client.from("social_reels").select("id, title, published, is_featured");
  console.log(`Social Reels: ${cmsReels?.length || 0} (${cmsReels?.filter(r => r.published).length || 0} published, ${cmsReels?.filter(r => r.is_featured).length || 0} featured)`);

  const { data: cmsBlog } = await client.from("blog_posts").select("id, title, published, status");
  console.log(`Blog Posts: ${cmsBlog?.length || 0} (${cmsBlog?.filter(b => b.published).length || 0} published)`);

  const { data: cmsProducts } = await client.from("products").select("id, title, published, is_featured");
  console.log(`Digital Products: ${cmsProducts?.length || 0} (${cmsProducts?.filter(p => p.published).length || 0} published)`);

  const { data: cmsTestimonials } = await client.from("testimonials").select("id, client_name, published, featured");
  console.log(`Testimonials (Proof): ${cmsTestimonials?.length || 0} (${cmsTestimonials?.filter(t => t.published).length || 0} published)`);

  // Storage Buckets
  console.log("\n--- STORAGE BUCKETS ---");
  const { data: buckets, error: bErr } = await client.storage.listBuckets();
  if (bErr) {
    console.log("Bucket listing error:", bErr.message);
  } else {
    console.log(`Found ${buckets?.length || 0} storage buckets:`);
    for (const b of buckets || []) {
      console.log(`  - [${b.id}] name="${b.name}" public=${b.public} created_at=${b.created_at}`);
    }
  }

  // Financial Accounts
  console.log("\n--- FINANCIAL ACCOUNTS ---");
  const { data: accounts } = await client.from("financial_accounts").select("id, name, account_type, opening_balance, current_balance, status");
  for (const a of accounts || []) {
    console.log(`  - [${a.id}] ${a.name} (${a.account_type}): opening=${a.opening_balance}, current=${a.current_balance}, status=${a.status}`);
  }

  // Contact submissions
  console.log("\n--- CONTACT SUBMISSIONS ---");
  const { data: inquiries } = await client.from("contact_submissions").select("id, name, email, status, converted_project_id, created_at");
  console.log(`Total Inquiries: ${inquiries?.length || 0}`);
  for (const inq of inquiries || []) {
    console.log(`  - [${inq.id}] "${inq.name}" <${inq.email}> status=${inq.status} convertedProj=${inq.converted_project_id}`);
  }

  console.log("\n=== AUDIT COMPLETE (ZERO MUTATIONS EXECUTED) ===");
}

runAudit().catch(console.error);
