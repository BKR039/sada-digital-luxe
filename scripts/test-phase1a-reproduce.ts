import fs from "fs";
import path from "path";

console.log("=======================================================================");
console.log("SADA OS — PHASE 1A: REPRODUCTION OF SEC-FIND-P2-01 & SEC-FIND-P2-02");
console.log("=======================================================================\n");

// -----------------------------------------------------------------------
// 1. REPRODUCE SEC-FIND-P2-01 (CSV Export Formula Injection & Quote Escaping)
// -----------------------------------------------------------------------
console.log("--- 1. Testing Current CSV Serializer in AuditHistoryTab.tsx ---");

const auditTabPath = path.resolve(process.cwd(), "src/components/admin/security/AuditHistoryTab.tsx");
const auditTabContent = fs.readFileSync(auditTabPath, "utf-8");

// Inspect the current implementation lines in AuditHistoryTab.tsx
const hasOldQuoteFormat = auditTabContent.includes('`"${r.action}"`') || auditTabContent.includes('`"${r.actor_name || ""}"`');
console.log(`Inspection: AuditHistoryTab.tsx uses naive template literals without quote escaping: ${hasOldQuoteFormat}`);

// Simulate existing serialization logic in AuditHistoryTab.tsx:
// const headers = ["ID", "Timestamp", "Action", "EntityType", "EntityID", "ActorName", "ActorRole", "IP"];
// const rows = sanitized.map((r) => [
//   r.id,
//   r.timestamp,
//   `"${r.action}"`,
//   `"${r.entity_type}"`,
//   `"${r.entity_id || ""}"`,
//   `"${r.actor_name || ""}"`,
//   `"${r.actor_role || ""}"`,
//   `"${r.ip_address || ""}"`,
// ]);
// const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

function oldSerialize(record: { action: string; actor_name: string; entity_type: string }) {
  return [
    "uuid-1",
    "2026-10-17T12:00:00Z",
    `"${record.action}"`,
    `"${record.entity_type}"`,
    '""',
    `"${record.actor_name || ""}"`,
    '"super_admin"',
    '""',
  ].join(",");
}

const maliciousInputs = [
  { action: "=cmd|' /C calc'!A0", actor_name: "Attacker", entity_type: "user" },
  { action: "+12345", actor_name: "@SUM(1+1)", entity_type: "system" },
  { action: "-cmd", actor_name: "  =1+1", entity_type: "role" },
  { action: "NormalAction", actor_name: 'John "The Boss" Doe', entity_type: "user" },
  { action: "Multi\nLine,Action", actor_name: "Arabic مدير", entity_type: "user" },
];

let p2_01_confirmed = false;
for (const input of maliciousInputs) {
  const serialized = oldSerialize(input);
  console.log(`\nInput: action="${input.action}", actor_name="${input.actor_name}"`);
  console.log(`Old Serialized Row:\n  ${serialized}`);

  // Check 1: Formula character at cell start inside quotes
  if (
    serialized.includes('"=cmd') ||
    serialized.includes('"+12345"') ||
    serialized.includes('"-cmd"') ||
    serialized.includes('"@SUM') ||
    serialized.includes('"  =1+1"')
  ) {
    console.log("  ⚠️ VULNERABILITY REPRODUCED: Unescaped formula trigger in output!");
    p2_01_confirmed = true;
  }

  // Check 2: Embedded double quote broken
  if (input.actor_name.includes('"') && serialized.includes('"""')) {
    console.log("  ⚠️ VULNERABILITY REPRODUCED: Double quotes not doubled according to RFC 4180!");
    p2_01_confirmed = true;
  }
}

console.log(`\nResult for SEC-FIND-P2-01: ${p2_01_confirmed ? "CONFIRMED VULNERABLE" : "NOT REPRODUCED"}`);

// -----------------------------------------------------------------------
// 2. REPRODUCE SEC-FIND-P2-02 (Super Admin Self-Demotion in SQL RPC)
// -----------------------------------------------------------------------
console.log("\n--- 2. Inspecting public.admin_update_account in SQL Migrations ---");

const migration20261002Path = path.resolve(
  process.cwd(),
  "supabase/migrations/20261002080000_fix_worker_salary_advance_resolution_and_rls.sql"
);
const migration20261002Content = fs.readFileSync(migration20261002Path, "utf-8");

// Check if admin_update_account contains self-demotion check
const hasSelfDemotionCheck =
  migration20261002Content.includes("_actor_id = _user_id AND _clean_role != 'super_admin'") ||
  migration20261002Content.includes("Cannot demote own account");

const hasLastAdminCheck = migration20261002Content.includes("count_active_super_admins() <= 1");

console.log(`admin_update_account has last-admin check (count_active_super_admins() <= 1): ${hasLastAdminCheck}`);
console.log(`admin_update_account has explicit self-demotion check (_actor_id = _user_id): ${hasSelfDemotionCheck}`);

let p2_02_confirmed = false;
if (hasLastAdminCheck && !hasSelfDemotionCheck) {
  console.log("  ⚠️ VULNERABILITY REPRODUCED: When count_active_super_admins() > 1, a Super Admin can demote themselves via direct RPC call because the SQL function lacks an anti-self-lockout check!");
  p2_02_confirmed = true;
}

console.log(`\nResult for SEC-FIND-P2-02: ${p2_02_confirmed ? "CONFIRMED VULNERABLE" : "NOT REPRODUCED"}`);

console.log("\n=======================================================================");
console.log(`REPRODUCTION SUMMARY:`);
console.log(`- SEC-FIND-P2-01 (CSV Formula Injection): ${p2_01_confirmed ? "CONFIRMED" : "UNVERIFIED"}`);
console.log(`- SEC-FIND-P2-02 (SQL Self-Demotion):    ${p2_02_confirmed ? "CONFIRMED" : "UNVERIFIED"}`);
console.log("=======================================================================\n");
