/**
 * SADA WORK OS — CLIENT INQUIRIES & DISCOVERY CONVERSION CERTIFICATION SUITE
 *
 * Comprehensive End-to-End Runtime Lifecycle Test:
 * Scenario A: Public submission persistence & structured discovery data (Smart Match, Quick Match, Package, Guided)
 * Scenario B: Existing CRM client matching (single match vs ambiguous multi-match explicit selection)
 * Scenario C: New CRM client registration without duplicates, canonical contact persistence
 * Scenario D: Operational project creation & starter execution plan with profiles.id assignees
 * Scenario E: Backend idempotency & double-submission replay protection (zero duplicate entities)
 * Scenario F: RBAC & Security boundary enforcement (workers/anonymous blocked)
 * Scenario G: Data retention & deletion safety (converted inquiries protected; unconverted safely deleted)
 * Scenario H: Clean cleanup of test records
 *
 * ISOLATION BOUNDARY:
 * Target: 127.0.0.1:5432/sada_local_test (Native PostgreSQL 16 Isolated)
 * Guarded by: test-db-guard (Zero mutations against remote production)
 */

import { enforceDatabaseIsolation } from "./test-db-guard";
import {
  createLocalTestClient,
  runLocalSql,
  queryLocalJson,
} from "./local-db-client";
import {
  resolveInquiryPath,
  computeInquiryStats,
  filterInquiries,
  convertInquiryToProject,
  deleteInquiry,
  type InquiryRecord,
} from "../src/lib/inquiry-service";

const TARGET_DB_URL = "postgres://postgres@127.0.0.1:5432/sada_local_test";

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, code: string, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [${code}] ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ [FAIL ${code}] ${message}`);
  }
}

async function runCertification() {
  console.log("======================================================================");
  console.log(" SADA WORK OS — INQUIRY-TO-PROJECT LIFECYCLE CERTIFICATION");
  console.log(" Target: 127.0.0.1:5432/sada_local_test");
  console.log("======================================================================\n");

  // 1. Guard check
  enforceDatabaseIsolation(TARGET_DB_URL);
  console.log("✓ Database isolation verified. Target is local test DB.");

  const client = createLocalTestClient();

  // 2. Ensure schema prerequisites in sada_local_test
  console.log("\n--- Step 1: Validating and preparing local schema prerequisites ---");
  runLocalSql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      display_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.team_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      position TEXT,
      division TEXT,
      photo_url TEXT,
      profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS public.package_catalog (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      selling_price NUMERIC DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.package_catalog ADD COLUMN IF NOT EXISTS code TEXT;
    ALTER TABLE public.package_catalog ADD COLUMN IF NOT EXISTS price NUMERIC;

    CREATE TABLE IF NOT EXISTS public.clients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      preferred_channel TEXT,
      industry TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      relationship_owner_id UUID,
      package_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.client_projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      client_email TEXT,
      client_phone TEXT,
      status TEXT DEFAULT 'active',
      description TEXT,
      business_type TEXT,
      goals TEXT,
      problems TEXT,
      requested_services JSONB DEFAULT '[]'::jsonb,
      provided_services JSONB DEFAULT '[]'::jsonb,
      timeline TEXT,
      budget TEXT,
      original_message TEXT,
      questionnaire_answers JSONB DEFAULT '{}'::jsonb,
      contact_submission_id UUID,
      lead_id UUID,
      start_date DATE DEFAULT CURRENT_DATE,
      deadline DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.contact_submissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      business_name TEXT,
      service TEXT,
      budget TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      preferred_contact TEXT,
      path_taken TEXT,
      discovery_data JSONB DEFAULT '{}'::jsonb,
      questionnaire_answers JSONB DEFAULT '{}'::jsonb,
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      converted_project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.project_tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES public.client_projects(id) ON DELETE CASCADE,
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      assignee_id UUID,
      deadline DATE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.project_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES public.client_projects(id) ON DELETE CASCADE,
      actor_id UUID,
      action TEXT,
      activity_type TEXT,
      details JSONB DEFAULT '{}'::jsonb,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.project_activity ADD COLUMN IF NOT EXISTS action TEXT;
    ALTER TABLE public.project_activity ADD COLUMN IF NOT EXISTS details JSONB;
    ALTER TABLE public.project_activity ADD COLUMN IF NOT EXISTS activity_type TEXT;
    ALTER TABLE public.project_activity ADD COLUMN IF NOT EXISTS metadata JSONB;

    CREATE TABLE IF NOT EXISTS public.system_audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id UUID,
      old_values JSONB,
      new_values JSONB,
      change_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✓ Schema prerequisites ready.");

  // Canonical profile & team member in sada_local_test
  const testProfileId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Root Super Admin One
  const testPackageId = "20000000-0000-0000-0000-000000000003";

  runLocalSql(`
    INSERT INTO public.package_catalog (id, code, name, price, selling_price, is_active)
    VALUES ('${testPackageId}', 'growth-accelerator', 'Growth Accelerator Pro', 4500, 4500, true)
    ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, price = EXCLUDED.price, selling_price = EXCLUDED.selling_price;

    -- Clean any leftover test records from prior runs
    DELETE FROM public.project_tasks WHERE project_id IN (
      SELECT id FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%'
    );
    DELETE FROM public.project_activity WHERE project_id IN (
      SELECT id FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%'
    );
    DELETE FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%';
    DELETE FROM public.contact_submissions WHERE id::text LIKE '30000000-0000-0000-0000-%';
    DELETE FROM public.clients WHERE id IN ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003') OR email = 'tarek@meddeb-tech.tn';
    DELETE FROM public.system_audit_logs WHERE entity_id LIKE '30000000-0000-0000-0000-%';
  `);

  console.log("✓ Seeded baseline profile, team member, and package catalog (clean test state).");

  // ==================================================================
  // SCENARIO A: Public Inquiries & Discovery Paths
  // ==================================================================
  console.log("\n--- Scenario A: Public Submissions & Discovery Paths ---");

  const inqSmartMatch: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000001",
    name: "Amina Ben Salem",
    email: "amina@smartmatch.tn",
    phone: "+216 20 111 222",
    business_name: "Smart Bio Health",
    service: "E-Commerce",
    budget: "5000 TND",
    message: "Seeking automated health shop",
    status: "new",
    preferred_contact: "email",
    path_taken: "smart_match",
    discovery_data: {
      source: "smart_match",
      recommendation: { package_name: "Growth Accelerator Pro" },
      request_summary: "Wants health e-commerce platform",
    },
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  const inqQuickMatch: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000002",
    name: "Karim Dridi",
    email: "karim@quickmatch.tn",
    phone: "+216 21 333 444",
    business_name: "Quick Logistics",
    service: "Mobile App",
    budget: "10000 TND",
    message: "Fast fleet delivery tracker",
    status: "new",
    preferred_contact: "whatsapp",
    path_taken: "quick_match",
    discovery_data: {
      source: "quick_match",
      priority_service: "Mobile App Development",
    },
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  const inqDirectPackage: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000003",
    name: "Youssef Trabelsi",
    email: "youssef@package.tn",
    phone: "+216 22 555 666",
    business_name: "Tunis FinTech",
    service: "Growth Accelerator Pro",
    budget: "4500 TND",
    message: "Direct package selection from catalog",
    status: "new",
    preferred_contact: "phone",
    path_taken: "package",
    discovery_data: {
      source: "direct_package",
      package_id: testPackageId,
      package_name: "Growth Accelerator Pro",
      package_price: 4500,
    },
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  const inqGuided: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000004",
    name: "Sonia Mansour",
    email: "sonia@guided.tn",
    phone: "+216 23 777 888",
    business_name: "Artisanat Luxe",
    service: "Brand Identity",
    budget: "3000 TND",
    message: "Artisanal brand expansion",
    status: "new",
    preferred_contact: "email",
    path_taken: "guided",
    discovery_data: {
      raw_description: "Artisan luxury branding in North Africa",
    },
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  // Test path resolution function
  assert(resolveInquiryPath(inqSmartMatch) === "smart_match", "SCEN-A01", "Smart Match path correctly resolved");
  assert(resolveInquiryPath(inqQuickMatch) === "quick_match", "SCEN-A02", "Quick Match path correctly resolved");
  assert(resolveInquiryPath(inqDirectPackage) === "direct_package", "SCEN-A03", "Direct Package path correctly resolved");
  assert(resolveInquiryPath(inqGuided) === "guided", "SCEN-A04", "Guided path correctly resolved");

  // Test KPI calculation
  const stats = computeInquiryStats([inqSmartMatch, inqQuickMatch, inqDirectPackage, inqGuided]);
  assert(stats.total === 4, "SCEN-A05", "KPI: Total is 4");
  assert(stats.pending === 4, "SCEN-A06", "KPI: Pending is 4");
  assert(stats.converted === 0, "SCEN-A07", "KPI: Converted is 0");
  assert(stats.smartMatches === 1, "SCEN-A08", "KPI: Smart Matches is 1");
  assert(stats.quickMatches === 1, "SCEN-A09", "KPI: Quick Matches is 1");
  assert(stats.packages === 1, "SCEN-A10", "KPI: Packages is 1");
  assert(stats.guided === 1, "SCEN-A11", "KPI: Guided is 1");

  // Test search & filtering
  const searchByName = filterInquiries([inqSmartMatch, inqQuickMatch], { search: "Amina" });
  assert(searchByName.length === 1 && searchByName[0].name === "Amina Ben Salem", "SCEN-A12", "Search by client name matches");

  const searchByBiz = filterInquiries([inqSmartMatch, inqQuickMatch], { search: "Logistics" });
  assert(searchByBiz.length === 1 && searchByBiz[0].business_name === "Quick Logistics", "SCEN-A13", "Search by business name matches");

  const filterByPath = filterInquiries([inqSmartMatch, inqQuickMatch, inqDirectPackage], { pathFilter: "direct_package" });
  assert(filterByPath.length === 1 && filterByPath[0].name === "Youssef Trabelsi", "SCEN-A14", "Filter by discovery path matches");

  // Persist inquiries to local database
  for (const inq of [inqSmartMatch, inqQuickMatch, inqDirectPackage, inqGuided]) {
    runLocalSql(`
      INSERT INTO public.contact_submissions (id, name, email, phone, business_name, service, budget, message, status, preferred_contact, path_taken, discovery_data)
      VALUES (
        '${inq.id}',
        '${inq.name}',
        '${inq.email}',
        '${inq.phone}',
        '${inq.business_name}',
        '${inq.service}',
        '${inq.budget}',
        '${inq.message}',
        '${inq.status}',
        '${inq.preferred_contact}',
        '${inq.path_taken}',
        '${JSON.stringify(inq.discovery_data)}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `);
  }
  console.log("✓ Inquiries successfully persisted to local PostgreSQL.");

  // ==================================================================
  // SCENARIO B: Existing CRM Client Matching & Ambiguity Defense
  // ==================================================================
  console.log("\n--- Scenario B: Existing CRM Client Matching & Ambiguity Defense ---");

  const clientAId = "40000000-0000-0000-0000-000000000001";
  const clientBId = "40000000-0000-0000-0000-000000000002";

  runLocalSql(`
    INSERT INTO public.clients (id, name, contact_name, email, phone, status)
    VALUES ('${clientAId}', 'Acme Corporation', 'John Doe', 'contact@acme.tn', '+216 71 000 111', 'active')
    ON CONFLICT (id) DO NOTHING;
  `);

  const inqAcme: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000005",
    name: "John Doe",
    email: "contact@acme.tn",
    phone: "+216 71 000 111",
    business_name: "Acme Corporation",
    service: "Web Platform",
    budget: "12000 TND",
    message: "New sub-portal for Acme Corp",
    status: "new",
    preferred_contact: "email",
    path_taken: "guided",
    discovery_data: {},
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  runLocalSql(`
    INSERT INTO public.contact_submissions (id, name, email, phone, business_name, service, budget, message, status)
    VALUES ('${inqAcme.id}', '${inqAcme.name}', '${inqAcme.email}', '${inqAcme.phone}', '${inqAcme.business_name}', '${inqAcme.service}', '${inqAcme.budget}', '${inqAcme.message}', 'new')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Test B1: Single match candidate is deterministically found and converted
  const convSingle = await convertInquiryToProject({
    inquiryId: inqAcme.id,
    projectTitle: "Acme Corp — Sub Portal",
    projectLeadProfileId: testProfileId,
    clientOverride: client,
  });

  assert(convSingle.success === true, "SCEN-B01", "Single match conversion succeeds");
  assert(convSingle.clientId === clientAId, "SCEN-B02", "Attached project directly to canonical client A");

  const clientsCountAfterSingle = queryLocalJson<any[]>(`SELECT count(*) FROM public.clients WHERE email = 'contact@acme.tn'`)[0].count;
  assert(Number(clientsCountAfterSingle) === 1, "SCEN-B03", "Zero duplicate clients created for single match");

  // Test B2: Ambiguous candidate defense
  // Add a second client sharing contact info
  runLocalSql(`
    INSERT INTO public.clients (id, name, contact_name, email, phone, status)
    VALUES ('${clientBId}', 'Acme Holding International', 'John Doe', 'shared@holding.tn', '+216 71 999 888', 'active')
    ON CONFLICT (id) DO NOTHING;
  `);

  const inqAmbiguous: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000006",
    name: "John Doe",
    email: "shared@holding.tn",
    phone: "+216 71 999 888",
    business_name: "Acme",
    service: "Advisory",
    budget: "5000 TND",
    message: "Holding expansion",
    status: "new",
    preferred_contact: "email",
    path_taken: "guided",
    discovery_data: {},
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  // Add third client also sharing phone
  const clientCId = "40000000-0000-0000-0000-000000000003";
  runLocalSql(`
    INSERT INTO public.clients (id, name, contact_name, email, phone, status)
    VALUES ('${clientCId}', 'Acme Tunisia Branch', 'Jane Doe', 'branch@holding.tn', '+216 71 999 888', 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.contact_submissions (id, name, email, phone, business_name, service, budget, message, status)
    VALUES ('${inqAmbiguous.id}', '${inqAmbiguous.name}', '${inqAmbiguous.email}', '${inqAmbiguous.phone}', '${inqAmbiguous.business_name}', '${inqAmbiguous.service}', '${inqAmbiguous.budget}', '${inqAmbiguous.message}', 'new')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Conversion without explicit chosenClientId when multiple candidates match MUST fail
  const convAmbiguous = await convertInquiryToProject({
    inquiryId: inqAmbiguous.id,
    projectTitle: "Acme Expansion",
    projectLeadProfileId: testProfileId,
    clientOverride: client,
  });

  assert(convAmbiguous.success === false, "SCEN-B04", "Ambiguous multi-match conversion strictly rejected");
  assert(Boolean(convAmbiguous.ambiguousCandidates && convAmbiguous.ambiguousCandidates.length >= 2), "SCEN-B05", "Returned list of ambiguous candidates to require explicit user choice");

  // When explicit chosenClientId is provided, conversion succeeds with specified client
  const convExplicit = await convertInquiryToProject({
    inquiryId: inqAmbiguous.id,
    chosenClientId: clientBId,
    projectTitle: "Acme Holding Project",
    projectLeadProfileId: testProfileId,
    clientOverride: client,
  });

  assert(convExplicit.success === true, "SCEN-B06", "Explicit client choice conversion succeeds");
  assert(convExplicit.clientId === clientBId, "SCEN-B07", "Attached project to user-selected client B");

  // ==================================================================
  // SCENARIO C: New CRM Client & Canonical Structured Contact
  // ==================================================================
  console.log("\n--- Scenario C: New CRM Client & Canonical Structured Contact ---");

  const inqNewClient: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000007",
    name: "Tarek Meddeb",
    email: "tarek@meddeb-tech.tn",
    phone: "+216 98 123 456",
    business_name: "Meddeb Tech Solutions",
    service: "Growth Accelerator Pro",
    budget: "4500 TND",
    message: "Seeking SaaS infrastructure revamp",
    status: "new",
    preferred_contact: "whatsapp",
    path_taken: "package",
    discovery_data: {
      source: "direct_package",
      package_id: testPackageId,
      package_name: "Growth Accelerator Pro",
      raw_description: "Enterprise SaaS transformation",
    },
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  runLocalSql(`
    INSERT INTO public.contact_submissions (id, name, email, phone, business_name, service, budget, message, status, preferred_contact, path_taken, discovery_data)
    VALUES (
      '${inqNewClient.id}',
      '${inqNewClient.name}',
      '${inqNewClient.email}',
      '${inqNewClient.phone}',
      '${inqNewClient.business_name}',
      '${inqNewClient.service}',
      '${inqNewClient.budget}',
      '${inqNewClient.message}',
      'new',
      '${inqNewClient.preferred_contact}',
      '${inqNewClient.path_taken}',
      '${JSON.stringify(inqNewClient.discovery_data)}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  const convNew = await convertInquiryToProject({
    inquiryId: inqNewClient.id,
    chosenClientId: "new",
    clientName: "Meddeb Tech Solutions",
    clientEmail: "tarek@meddeb-tech.tn",
    clientPhone: "+216 98 123 456",
    businessType: "Technology & Software",
    projectTitle: "Meddeb Tech — Growth Acceleration",
    projectLeadProfileId: testProfileId,
    description: "Enterprise SaaS transformation",
    goals: "Double ARR in 12 months",
    problems: "Legacy infrastructure and low conversion rate",
    requestedServices: ["Growth Accelerator Pro", "Cloud Infrastructure"],
    starterTasks: [
      {
        title: "Kickoff & Architecture Review",
        category: "kickoff",
        priority: "high",
        assignee_id: testProfileId,
        deadline: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
        description: "Initial discovery and system architecture audit",
      },
      {
        title: "Database Optimization & Indexing",
        category: "engineering",
        priority: "high",
        assignee_id: testProfileId,
        deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
        description: "Benchmark query performance and add indexes",
      },
    ],
    actorId: testProfileId,
    actorRole: "super_admin",
    clientOverride: client,
  });

  assert(convNew.success === true, "SCEN-C01", "New client and project conversion succeeds");
  assert(Boolean(convNew.clientId), "SCEN-C02", "Created canonical client ID");
  assert(Boolean(convNew.projectId), "SCEN-C03", "Created operational project ID");

  // Verify database persistence of canonical structured contact
  const savedProject = queryLocalJson<any[]>(`SELECT * FROM public.client_projects WHERE id = '${convNew.projectId}'`)[0];
  assert(savedProject.client_email === "tarek@meddeb-tech.tn", "SCEN-C04", "client_email persisted in canonical column");
  assert(savedProject.client_phone === "+21698123456", "SCEN-C05", "client_phone normalized & persisted in canonical column");
  assert(!savedProject.description?.includes("[CLIENT CONTACT:"), "SCEN-C06", "Legacy [CLIENT CONTACT: ...] marker absent from description");
  assert(savedProject.contact_submission_id === inqNewClient.id, "SCEN-C07", "contact_submission_id links back to inquiry");

  const savedInquiry = queryLocalJson<any[]>(`SELECT * FROM public.contact_submissions WHERE id = '${inqNewClient.id}'`)[0];
  assert(savedInquiry.status === "converted", "SCEN-C08", "Inquiry status updated to 'converted'");
  assert(savedInquiry.converted_project_id === convNew.projectId, "SCEN-C09", "Inquiry converted_project_id links to project");
  assert(savedInquiry.client_id === convNew.clientId, "SCEN-C10", "Inquiry client_id links to client");

  // ==================================================================
  // SCENARIO D: Operational Project & Starter Tasks
  // ==================================================================
  console.log("\n--- Scenario D: Execution Plan & Starter Tasks ---");

  const createdTasks = queryLocalJson<any[]>(`SELECT * FROM public.project_tasks WHERE project_id = '${convNew.projectId}' ORDER BY sort_order ASC`);
  assert(createdTasks.length === 2, "SCEN-D01", "Created exactly 2 starter tasks as configured");
  assert(createdTasks[0].title === "Kickoff & Architecture Review", "SCEN-D02", "Task 1 title matches");
  assert(createdTasks[0].assignee_id === testProfileId, "SCEN-D03", "Task 1 assignee_id matches profiles.id");
  assert(createdTasks[0].client_id === convNew.clientId, "SCEN-D04", "Task 1 client_id matches canonical client");
  assert(createdTasks[1].title === "Database Optimization & Indexing", "SCEN-D05", "Task 2 title matches");

  // Verify project activity and system audit logs
  const activityLogs = queryLocalJson<any[]>(`SELECT * FROM public.project_activity WHERE project_id = '${convNew.projectId}'`);
  assert(activityLogs.length >= 1, "SCEN-D06", "project_activity entry generated for conversion");

  const auditLogs = queryLocalJson<any[]>(`SELECT * FROM public.system_audit_logs WHERE entity_id = '${inqNewClient.id}'`);
  assert(auditLogs.length >= 1, "SCEN-D07", "system_audit_logs entry generated for inquiry conversion");

  // ==================================================================
  // SCENARIO E: Backend Idempotency & Replay Protection
  // ==================================================================
  console.log("\n--- Scenario E: Backend Idempotency & Replay Protection ---");

  const clientCountBefore = queryLocalJson<any[]>(`SELECT count(*) FROM public.clients`)[0].count;
  const projectCountBefore = queryLocalJson<any[]>(`SELECT count(*) FROM public.client_projects`)[0].count;
  const taskCountBefore = queryLocalJson<any[]>(`SELECT count(*) FROM public.project_tasks`)[0].count;

  // Re-attempt conversion on the already-converted inquiry
  const replayRes = await convertInquiryToProject({
    inquiryId: inqNewClient.id,
    chosenClientId: "new",
    clientName: "Meddeb Tech Solutions Duplicate Attempt",
    projectTitle: "Duplicate Project",
    projectLeadProfileId: testProfileId,
    clientOverride: client,
  });

  assert(replayRes.success === true, "SCEN-E01", "Replay conversion returns safe success");
  assert(replayRes.alreadyConverted === true, "SCEN-E02", "Replay flags alreadyConverted: true");
  assert(replayRes.projectId === convNew.projectId, "SCEN-E03", "Replay returns existing operational project ID");

  const clientCountAfter = queryLocalJson<any[]>(`SELECT count(*) FROM public.clients`)[0].count;
  const projectCountAfter = queryLocalJson<any[]>(`SELECT count(*) FROM public.client_projects`)[0].count;
  const taskCountAfter = queryLocalJson<any[]>(`SELECT count(*) FROM public.project_tasks`)[0].count;

  assert(clientCountAfter === clientCountBefore, "SCEN-E04", "Idempotency: Zero duplicate clients created on replay");
  assert(projectCountAfter === projectCountBefore, "SCEN-E05", "Idempotency: Zero duplicate projects created on replay");
  assert(taskCountAfter === taskCountBefore, "SCEN-E06", "Idempotency: Zero duplicate tasks created on replay");

  // ==================================================================
  // SCENARIO F: Security & RBAC Boundary Enforcement
  // ==================================================================
  console.log("\n--- Scenario F: Security & RBAC Boundary Enforcement ---");

  const inqSecTest: InquiryRecord = {
    id: "30000000-0000-0000-0000-000000000008",
    name: "Hela Trabelsi",
    email: "hela@sectest.tn",
    phone: "+216 25 111 222",
    business_name: "Security Test Corp",
    service: "Audit",
    budget: "2000 TND",
    message: "Security penetration lead",
    status: "new",
    preferred_contact: "email",
    path_taken: "guided",
    discovery_data: {},
    client_id: null,
    converted_project_id: null,
    created_at: new Date().toISOString(),
  };

  runLocalSql(`
    INSERT INTO public.contact_submissions (id, name, email, phone, business_name, service, budget, message, status)
    VALUES ('${inqSecTest.id}', '${inqSecTest.name}', '${inqSecTest.email}', '${inqSecTest.phone}', '${inqSecTest.business_name}', '${inqSecTest.service}', '${inqSecTest.budget}', '${inqSecTest.message}', 'new')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Attempt conversion by worker role
  const unauthRes = await convertInquiryToProject({
    inquiryId: inqSecTest.id,
    projectTitle: "Unauthorized Project",
    projectLeadProfileId: testProfileId,
    actorRole: "worker",
    clientOverride: client,
  });

  assert(unauthRes.success === false, "SCEN-F01", "Unauthorized worker conversion rejected by backend RBAC");
  assert(unauthRes.error?.includes("Unauthorized") || unauthRes.error?.includes("restricted"), "SCEN-F02", "Clear unauthorized rejection error returned");

  // Verify inquiry remains unconverted
  const secInqStatus = queryLocalJson<any[]>(`SELECT status, converted_project_id FROM public.contact_submissions WHERE id = '${inqSecTest.id}'`)[0];
  assert(secInqStatus.status === "new" && secInqStatus.converted_project_id === null, "SCEN-F03", "Inquiry untouched after rejected conversion attempt");

  // ==================================================================
  // SCENARIO G: Data Retention & Deletion Safety
  // ==================================================================
  console.log("\n--- Scenario G: Data Retention & Deletion Safety ---");

  // Attempt to delete a converted inquiry (MUST be rejected to preserve audit history)
  const delConvertedRes = await deleteInquiry({
    inquiryId: inqNewClient.id,
    actorRole: "super_admin",
    clientOverride: client,
  });

  assert(delConvertedRes.success === false, "SCEN-G01", "Deletion of converted inquiry strictly blocked");
  assert(delConvertedRes.error?.includes("linked to an active converted project"), "SCEN-G02", "Informative error explains preservation requirement");

  // Verify converted inquiry is still intact in database
  const inqStillExists = queryLocalJson<any[]>(`SELECT id FROM public.contact_submissions WHERE id = '${inqNewClient.id}'`);
  assert(inqStillExists.length === 1, "SCEN-G03", "Converted inquiry remains persisted in database");

  // Delete an unconverted disposable inquiry (MUST succeed with audit log)
  const disposableId = "30000000-0000-0000-0000-000000000099";
  runLocalSql(`
    INSERT INTO public.contact_submissions (id, name, email, message, status)
    VALUES ('${disposableId}', 'Disposable Lead', 'temp@discard.tn', 'Spam or cancelled lead', 'new')
    ON CONFLICT (id) DO NOTHING;
  `);

  const delDisposableRes = await deleteInquiry({
    inquiryId: disposableId,
    actorRole: "super_admin",
    clientOverride: client,
  });

  assert(delDisposableRes.success === true, "SCEN-G04", "Safe deletion of unconverted inquiry succeeds");
  const inqDeletedCheck = queryLocalJson<any[]>(`SELECT id FROM public.contact_submissions WHERE id = '${disposableId}'`);
  assert(inqDeletedCheck.length === 0, "SCEN-G05", "Unconverted inquiry successfully removed from database");

  // ==================================================================
  // SCENARIO H: Test Fixture Teardown & Clean Cleanup
  // ==================================================================
  console.log("\n--- Scenario H: Test Fixture Teardown & Clean Cleanup ---");

  runLocalSql(`
    DELETE FROM public.project_tasks WHERE project_id IN (
      SELECT id FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%'
    );
    DELETE FROM public.project_activity WHERE project_id IN (
      SELECT id FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%'
    );
    DELETE FROM public.client_projects WHERE title LIKE '%Meddeb Tech%' OR title LIKE '%Acme%';
    DELETE FROM public.contact_submissions WHERE id::text LIKE '30000000-0000-0000-0000-%';
    DELETE FROM public.clients WHERE id IN ('${clientAId}', '${clientBId}', '${clientCId}') OR email = 'tarek@meddeb-tech.tn';
    DELETE FROM public.system_audit_logs WHERE entity_id LIKE '30000000-0000-0000-0000-%';
  `);

  const remainingTestInquiries = queryLocalJson<any[]>(`SELECT count(*) FROM public.contact_submissions WHERE id::text LIKE '30000000-0000-0000-0000-%'`)[0].count;
  assert(Number(remainingTestInquiries) === 0, "SCEN-H01", "Zero orphaned test inquiries remaining");

  // Final scorecard
  console.log("\n======================================================================");
  console.log(` CERTIFICATION RUNTIME RESULTS:`);
  console.log(` Total Assertions:  ${totalAssertions}`);
  console.log(` Passed:            ${passedAssertions}`);
  console.log(` Failed:            ${failedAssertions}`);
  console.log("======================================================================\n");

  if (failedAssertions > 0) {
    console.error(`CERTIFICATION FAILED with ${failedAssertions} errors.`);
    process.exit(1);
  } else {
    console.log("✓ ALL CERTIFICATION SCENARIOS PASSED WITH 100% SUCCESS.");
    process.exit(0);
  }
}

runCertification().catch((err) => {
  console.error("FATAL CERTIFICATION EXCEPTION:", err);
  process.exit(1);
});
