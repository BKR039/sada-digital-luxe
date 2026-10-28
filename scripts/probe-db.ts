import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env
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
const supabase = createClient(supabaseUrl, anonKey);

async function inspect() {
  console.log("=== SUPABASE DATABASE AUDIT ===");
  const { data: saLogin, error: saErr } = await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  console.log("Super Admin login:", saLogin?.user?.email, "Error:", saErr?.message);

  const pkgs = await supabase.from("packages").select("id, name, selling_price");
  console.log("Existing packages in 'packages' table:", pkgs.data?.length, pkgs.data);

  const clients = await supabase.from("clients").select("id, name, package_id");
  console.log("Clients count:", clients.data?.length);
  console.log("Clients with package_id:", clients.data?.filter((c: any) => c.package_id));

  const deals = await supabase.from("deals").select("id, title, package_id");
  console.log("Deals count:", deals.data?.length);
  console.log("Deals with package_id:", deals.data?.filter((d: any) => d.package_id));

  const cd = await supabase.from("client_deliverables").select("id, title, package_id");
  console.log("Client deliverables with package_id:", cd.data?.filter((d: any) => d.package_id));

  // Check if package_catalog exists
  const pc = await supabase.from("package_catalog").select("*").limit(1);
  console.log("package_catalog exists?:", !pc.error, pc.error?.message);

  // Check if package_categories exists
  const pcat = await supabase.from("package_categories").select("*").limit(1);
  console.log("package_categories exists?:", !pcat.error, pcat.error?.message);

  // Check if package_addons exists
  const paddons = await supabase.from("package_addons").select("*").limit(1);
  console.log("package_addons exists?:", !paddons.error, paddons.error?.message);
}

inspect();
