import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  }
}

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const PSQL_BIN = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "PostgreSQL16",
  "pgsql",
  "bin",
  "psql.exe"
);

function assertSafeTarget(): void {
  enforceDatabaseIsolation(LOCAL_DB_URL);
  if (!fs.existsSync(PSQL_BIN)) {
    throw new Error(`psql binary not found at ${PSQL_BIN}`);
  }
}

function getSanitizedEnv(): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = { ...process.env };
  safeEnv.PGHOST = TARGET_HOST;
  safeEnv.PGPORT = TARGET_PORT;
  safeEnv.PGDATABASE = TARGET_DB;
  safeEnv.PGUSER = "postgres";
  return safeEnv;
}

function runSql(sql: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB, "-c", sql],
    {
      env: getSanitizedEnv(),
      encoding: "utf-8",
    }
  ).trim();
}

async function inspect() {
  console.log("=== LOCAL TEST DATABASE (sada_local_test) ===");
  try {
    const hasTemplatesTable = runSql("SELECT to_regclass('public.workflow_templates');");
    console.log("public.workflow_templates:", hasTemplatesTable || "NOT FOUND");
    
    const hasStagesTable = runSql("SELECT to_regclass('public.workflow_stages');");
    console.log("public.workflow_stages:", hasStagesTable || "NOT FOUND");

    if (hasTemplatesTable) {
      const templateCols = runSql(`
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workflow_templates';
      `);
      console.log("workflow_templates cols:", templateCols);

      const countTemplates = runSql("SELECT count(*) FROM public.workflow_templates;");
      console.log("workflow_templates count:", countTemplates);

      const templates = runSql("SELECT task_type, name, is_active FROM public.workflow_templates;");
      console.log("workflow_templates rows:\n", templates);
    }

    if (hasStagesTable) {
      const stageCols = runSql(`
        SELECT string_agg(column_name || ' (' || data_type || ')', ', ')
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workflow_stages';
      `);
      console.log("workflow_stages cols:", stageCols);

      const countStages = runSql("SELECT count(*) FROM public.workflow_stages;");
      console.log("workflow_stages count:", countStages);

      const stages = runSql("SELECT template_id, title, stage_type, sort_order, duration_days FROM public.workflow_stages;");
      console.log("workflow_stages rows:\n", stages);
    }

    const taskCols = runSql(`
      SELECT string_agg(column_name, ', ')
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'project_tasks'
      AND column_name IN ('workflow_template_id', 'stage_key', 'stage_order', 'is_stage_locked', 'depends_on_stage_order');
    `);
    console.log("project_tasks workflow columns:", taskCols);

  } catch (err: any) {
    console.error("Local DB check error:", err.message);
  }

  console.log("\n=== REMOTE SUPABASE (READ ONLY) ===");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: tpls, error: tplErr } = await supabase.from("workflow_templates").select("id, task_type, name, is_active");
    console.log("Remote workflow_templates:", tplErr ? tplErr.message : tpls);

    const { data: stages, error: stageErr } = await supabase.from("workflow_stages").select("id, template_id, title, sort_order");
    console.log("Remote workflow_stages count:", stageErr ? stageErr.message : stages?.length);

    const { data: br, error: brErr } = await supabase.from("business_rules").select("rule_key, json_value").eq("rule_key", "task_workflow_templates");
    console.log("Remote business_rules task_workflow_templates:", brErr ? brErr.message : (br && br.length > 0 ? "EXISTS" : "NOT FOUND"));
  }
}

inspect();
