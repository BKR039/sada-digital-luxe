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

async function inspectAllClients() {
  console.log("Authenticating as QA Super Admin...");
  const { error: authErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  // Fetch sample client to inspect columns
  const { data: sampleClient } = await client.from("clients").select("*").limit(1);
  console.log("Sample client columns:", sampleClient ? Object.keys(sampleClient[0]) : "none");

  // Fetch all 45 clients
  const { data: clients, error: clientErr } = await client
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true });

  if (clientErr) {
    console.error("Client fetch error:", clientErr);
    return;
  }

  // Fetch relational tables for cross-referencing
  const { data: projects } = await client.from("client_projects").select("id, client_id");
  const { data: tasks } = await client.from("project_tasks").select("id, project_id");
  const { data: invoices } = await client.from("invoices").select("id, client_id, status, total_amount, paid_amount");
  const { data: incomes } = await client.from("income_transactions").select("id, client_id, amount, status");
  const { data: expenses } = await client.from("expense_transactions").select("id, client_id, amount, status");
  const { data: commissions } = await client.from("sales_commissions").select("id, client_id, status");
  const { data: sponsoring } = await client.from("sponsoring_campaigns").select("id, client_id, status");

  console.log(`\nTOTAL CLIENTS IN DATABASE: ${clients.length}`);

  const activeClients = clients.filter(c => c.status === "active");
  const archivedClients = clients.filter(c => c.status === "archived");
  const otherClients = clients.filter(c => c.status !== "active" && c.status !== "archived");

  console.log(`Active Clients: ${activeClients.length}`);
  console.log(`Archived Clients: ${archivedClients.length}`);
  console.log(`Other Status Clients: ${otherClients.length}`);

  const inventory = clients.map((c) => {
    const clientProjects = projects?.filter(p => p.client_id === c.id) || [];
    const projectIds = clientProjects.map(p => p.id);
    const clientTasks = tasks?.filter(t => projectIds.includes(t.project_id)) || [];
    const clientInvoices = invoices?.filter(i => i.client_id === c.id) || [];
    const clientIncomes = incomes?.filter(i => i.client_id === c.id) || [];
    const clientExpenses = expenses?.filter(e => e.client_id === c.id) || [];
    const clientCommissions = commissions?.filter(cm => cm.client_id === c.id) || [];
    const clientSponsoring = sponsoring?.filter(s => s.client_id === c.id) || [];

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      package_price: c.package_price ?? c.monthly_package ?? 0,
      created_at: c.created_at,
      project_count: clientProjects.length,
      task_count: clientTasks.length,
      invoice_count: clientInvoices.length,
      income_count: clientIncomes.length,
      expense_count: clientExpenses.length,
      commission_count: clientCommissions.length,
      sponsoring_count: clientSponsoring.length,
    };
  });

  const outPath = path.resolve(process.cwd(), "scripts/scratch-client-inventory-result.json");
  fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2));
  console.log(`Inventory saved to ${outPath}`);
}

inspectAllClients().catch(console.error);
