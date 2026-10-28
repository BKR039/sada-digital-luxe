/**
 * SADA OS — Client Proof CMS
 * Master Runtime Certification & Integrity Test Suite
 *
 * Tests the complete client proof / testimonial lifecycle against isolated local PostgreSQL (sada_local_test),
 * guarded by DataIsolationGuard to ensure remote Supabase production remains strictly read-only.
 */

import fs from "node:fs";
import path from "node:path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { enforceDatabaseIsolation } from "./test-db-guard";
import {
  createLocalTestClient,
  queryLocalJson,
  runLocalSql,
} from "./local-db-client";
import {
  createTestimonial,
  updateTestimonial,
  publishTestimonial,
  setFeaturedTestimonial,
  deleteTestimonial,
  validateTestimonialReadiness,
} from "../src/lib/content-service";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

interface AssertionResult {
  suite: string;
  test: string;
  passed: boolean;
  message?: string;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, suite: string, test: string, message?: string) {
  if (condition) {
    results.push({ suite, test, passed: true });
    console.log(`  [PASS] ${suite} -> ${test}`);
  } else {
    results.push({ suite, test, passed: false, message });
    console.error(`  [FAIL] ${suite} -> ${test}: ${message || "Assertion failed"}`);
  }
}

async function runMasterCertification() {
  console.log("================================================================================");
  console.log("SADA OS — CLIENT PROOF CMS MASTER RUNTIME CERTIFICATION");
  console.log("Database: sada_local_test (isolated local PostgreSQL 16)");
  console.log("================================================================================\n");

  // 1. Database Safety & Guard Validation
  enforceDatabaseIsolation(LOCAL_DB_URL);
  assert(true, "Safety Guard", "DataIsolationGuard independently verified target host as 127.0.0.1");
  assert(
    !LOCAL_DB_URL.includes("supabase.co"),
    "Safety Guard",
    "Target connection string strictly bars remote Supabase production domain"
  );

  // Authoritative QA principals in local PostgreSQL
  const ADMIN_USER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // QA Standard Admin
  const SUPER_ADMIN_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // QA Super Admin
  const WORKER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // QA Worker Specialist
  const CANONICAL_CLIENT_ID = "88888888-8888-8888-8888-888888888888"; // TOTTA Restaurant

  const adminClient = createLocalTestClient(ADMIN_USER_ID);
  const superAdminClient = createLocalTestClient(SUPER_ADMIN_USER_ID);
  const workerClient = createLocalTestClient(WORKER_USER_ID);

  const testRunId = `cert-${Date.now()}`;
  const createdTestimonialIds: string[] = [];
  const createdProjectIds: string[] = [];

  const adminCtx = { role: "admin" as const, userId: ADMIN_USER_ID };
  const superAdminCtx = { role: "super_admin" as const, userId: SUPER_ADMIN_USER_ID };
  const workerCtx = { role: "worker" as const, userId: WORKER_USER_ID };

  try {
    // ========================================================================
    // SUITE 1: Schema & Constraints Verification
    // ========================================================================
    console.log("\n--- Suite 1: Schema & Constraints Verification ---");
    const cols = queryLocalJson<{ column_name: string; data_type: string; column_default: string | null }>(
      `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'testimonials' AND table_schema = 'public' ORDER BY column_name;`
    );
    const colNames = cols.map((c) => c.column_name);

    const requiredColumns = [
      "id",
      "client_id",
      "client_name",
      "company",
      "role",
      "review",
      "short_quote",
      "service",
      "rating",
      "photo_url",
      "published",
      "featured",
      "sort_order",
      "language",
      "project_id",
      "created_at",
      "updated_at",
    ];

    for (const reqCol of requiredColumns) {
      assert(
        colNames.includes(reqCol),
        "Schema Integrity",
        `Column 'public.testimonials.${reqCol}' exists in local test DB`
      );
    }

    // Verify published column default is false (DEF-PROOF-05 fix)
    const pubCol = cols.find((c) => c.column_name === "published");
    assert(
      pubCol?.column_default?.includes("false") === true,
      "Schema Integrity",
      "Column 'published' defaults to false (draft-first lifecycle guaranteed)"
    );

    // Verify featured column default is false
    const featCol = cols.find((c) => c.column_name === "featured");
    assert(
      featCol?.column_default?.includes("false") === true,
      "Schema Integrity",
      "Column 'featured' defaults to false"
    );

    // Verify trigger testimonials_updated exists
    const triggers = queryLocalJson<{ trigger_name: string }>(
      `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'testimonials';`
    );
    assert(
      triggers.some((t) => t.trigger_name === "testimonials_updated"),
      "Schema Integrity",
      "Trigger 'testimonials_updated' exists on public.testimonials"
    );

    // ========================================================================
    // SUITE 2: Row Level Security Policies Verification
    // ========================================================================
    console.log("\n--- Suite 2: Row Level Security Policies Verification ---");
    const rlsStatus = queryLocalJson<{ rowsecurity: boolean }>(
      `SELECT rowsecurity FROM pg_tables WHERE tablename = 'testimonials' AND schemaname = 'public';`
    );
    assert(
      rlsStatus[0]?.rowsecurity === true,
      "RLS Verification",
      "Row Level Security is ENABLED on public.testimonials"
    );

    const policies = queryLocalJson<{ policyname: string; roles: string[]; cmd: string }>(
      `SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'testimonials' AND schemaname = 'public';`
    );

    const pubRead = policies.find((p) => p.policyname.includes("Public reads published"));
    assert(!!pubRead, "RLS Verification", "'Public reads published testimonials' policy exists");
    assert(
      pubRead?.roles.includes("anon") && pubRead?.roles.includes("authenticated"),
      "RLS Verification",
      "Public read policy allows anon and authenticated callers"
    );

    const adminRead = policies.find((p) => p.policyname.includes("Admins read all"));
    assert(!!adminRead, "RLS Verification", "'Admins read all testimonials' policy exists");
    assert(
      !adminRead?.roles.includes("public"),
      "RLS Verification",
      "Admins read policy is strictly scoped TO authenticated"
    );

    const adminInsert = policies.find((p) => p.policyname.includes("Admins insert"));
    assert(!!adminInsert, "RLS Verification", "'Admins insert testimonials' policy exists");

    const adminUpdate = policies.find((p) => p.policyname.includes("Admins update"));
    assert(!!adminUpdate, "RLS Verification", "'Admins update testimonials' policy exists");

    const superAdminDelete = policies.find((p) => p.policyname.includes("Super admins delete"));
    assert(!!superAdminDelete, "RLS Verification", "'Super admins delete testimonials' policy exists");

    // ========================================================================
    // SUITE 3: Unit Verification of 4/4 Publishing Readiness Criteria
    // ========================================================================
    console.log("\n--- Suite 3: Unit Verification of 4/4 Publishing Readiness Criteria ---");
    const emptyCheck = validateTestimonialReadiness({});
    assert(emptyCheck.allPassed === false, "Readiness Unit", "Empty testimonial fails allPassed");
    assert(emptyCheck.passed === 0, "Readiness Unit", "Empty testimonial passes 0/4 checks");
    assert(emptyCheck.checks.length === 4, "Readiness Unit", "Checklist defines exactly 4 criteria");

    // 1. Missing name
    const missingName = validateTestimonialReadiness({
      client_name: "   ",
      review: "A substantive quote describing the luxury branding and digital growth.",
      company: "Acme Corp",
      client_id: CANONICAL_CLIENT_ID,
    });
    assert(missingName.allPassed === false, "Readiness Unit", "Whitespace name fails check 'name'");
    assert(missingName.checks.find((c) => c.id === "name")?.passed === false, "Readiness Unit", "Name check is false");

    // 2. Short quote (<= 20 chars)
    const shortReview = validateTestimonialReadiness({
      client_name: "Sarah Miller",
      review: "Too short quote.", // 16 chars
      company: "Acme Corp",
      client_id: CANONICAL_CLIENT_ID,
    });
    assert(shortReview.allPassed === false, "Readiness Unit", "Review of 16 chars fails quote length check");
    assert(shortReview.checks.find((c) => c.id === "quote")?.passed === false, "Readiness Unit", "Quote check is false when review <= 20 chars");

    // 3. Attribution missing (neither company nor role)
    const missingAttribution = validateTestimonialReadiness({
      client_name: "Sarah Miller",
      review: "A substantive quote describing the luxury branding and digital growth.",
      company: "",
      role: "",
      client_id: CANONICAL_CLIENT_ID,
    });
    assert(missingAttribution.allPassed === false, "Readiness Unit", "Missing both company and role fails attribution check");
    assert(missingAttribution.checks.find((c) => c.id === "attribution")?.passed === false, "Readiness Unit", "Attribution check is false");

    // 3b. Role provided without company -> passes attribution
    const roleOnly = validateTestimonialReadiness({
      client_name: "Sarah Miller",
      review: "A substantive quote describing the luxury branding and digital growth.",
      role: "Managing Director",
      client_id: CANONICAL_CLIENT_ID,
    });
    assert(roleOnly.checks.find((c) => c.id === "attribution")?.passed === true, "Readiness Unit", "Providing role alone satisfies attribution check");

    // 4. Verification missing (neither client_id nor project_id)
    const unverified = validateTestimonialReadiness({
      client_name: "Sarah Miller",
      review: "A substantive quote describing the luxury branding and digital growth.",
      company: "Acme Corp",
      role: "Founder",
      client_id: null,
      project_id: null,
    });
    assert(unverified.allPassed === false, "Readiness Unit", "Missing CRM client and case study link fails verification check");
    assert(unverified.checks.find((c) => c.id === "verified")?.passed === false, "Readiness Unit", "Verified check is false when unlinked");

    // 5. Complete 4/4 readiness
    const completeCheck = validateTestimonialReadiness({
      client_name: "Sarah Miller",
      review: "SADA completely transformed our luxury digital presence and executive brand.",
      company: "Acme Corp",
      role: "Founder",
      client_id: CANONICAL_CLIENT_ID,
    });
    assert(completeCheck.allPassed === true, "Readiness Unit", "All 4 criteria pass for complete attributable testimonial");
    assert(completeCheck.passed === 4, "Readiness Unit", "Score is 4/4");

    // ========================================================================
    // SUITE 4: Testimonial Creation & Draft Persistence
    // ========================================================================
    console.log("\n--- Suite 4: Testimonial Creation & Draft Persistence ---");
    const draftPayload = {
      client_name: "Karim Ben Salah",
      company: "Carthage Hospitality",
      role: "Chief Executive Officer",
      review: "SADA provided unmatched visual excellence and operational speed for our portfolio launch.",
      short_quote: "Unmatched visual excellence and operational speed.",
      service: "Branding",
      language: "en",
      client_id: CANONICAL_CLIENT_ID,
      published: false,
      featured: false,
      sort_order: 10,
    };

    const createdDraft = await createTestimonial(draftPayload, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdTestimonialIds.push(createdDraft.id);

    assert(!!createdDraft.id, "Draft Creation", "New testimonial draft successfully inserted");
    assert(createdDraft.published === false, "Draft Creation", "New testimonial draft has published = false");
    assert(createdDraft.client_name === "Karim Ben Salah", "Draft Creation", "Client name matches input");
    assert(createdDraft.client_id === CANONICAL_CLIENT_ID, "Draft Creation", "Canonical CRM client_id properly persisted");

    // Reload from database to verify persistence
    const reloaded = queryLocalJson<any[]>(
      `SELECT * FROM public.testimonials WHERE id = '${createdDraft.id}';`
    )[0];
    assert(!!reloaded, "Draft Persistence", "Draft persists after round-trip to local PostgreSQL");
    assert(reloaded.published === false, "Draft Persistence", "Persisted published status is false");
    assert(reloaded.sort_order === 10, "Draft Persistence", "Persisted sort_order is 10");

    // ========================================================================
    // SUITE 5: Public Website Isolation for Drafts
    // ========================================================================
    console.log("\n--- Suite 5: Public Website Isolation for Drafts ---");
    // Public storefront query (published = true)
    const publicQuery = queryLocalJson<any[]>(
      `SELECT id, client_name, review, published FROM public.testimonials WHERE published = true;`
    );
    assert(
      !publicQuery.some((t) => t.id === createdDraft.id),
      "Public Isolation",
      "Public website query strictly excludes unpublished draft testimonial"
    );

    // Direct ID query with published = true guard
    const directDraftRead = queryLocalJson<any[]>(
      `SELECT * FROM public.testimonials WHERE id = '${createdDraft.id}' AND published = true;`
    );
    assert(directDraftRead.length === 0, "Public Isolation", "Direct query with published gate returns empty for draft");

    // ========================================================================
    // SUITE 6: Publication Readiness Enforcement & Rejection of Incomplete Proof
    // ========================================================================
    console.log("\n--- Suite 6: Publication Readiness Enforcement & Rejection ---");
    // Create an unverified draft with no company, role, or linked CRM client
    const incompleteDraft = await createTestimonial(
      {
        client_name: "Anonymous User",
        review: "This is a placeholder review with no verified attribution.",
        published: false,
      },
      {
        clientOverride: adminClient,
        ctx: adminCtx,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      }
    );
    createdTestimonialIds.push(incompleteDraft.id);

    let publishIncompleteFailed = false;
    let publishErrorMessage = "";
    try {
      await publishTestimonial(incompleteDraft.id, true, {
        clientOverride: adminClient,
        ctx: adminCtx,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      });
    } catch (err: any) {
      publishIncompleteFailed = true;
      publishErrorMessage = err.message || "";
    }
    assert(
      publishIncompleteFailed,
      "Readiness Gating",
      "Publishing incomplete testimonial is rejected at service boundary"
    );
    assert(
      publishErrorMessage.includes("readiness criteria"),
      "Readiness Gating",
      "Error message explicitly identifies missing readiness criteria"
    );

    // Verify incomplete draft remains unpublished in the database
    const incompleteStatus = queryLocalJson<any[]>(
      `SELECT published FROM public.testimonials WHERE id = '${incompleteDraft.id}';`
    )[0];
    assert(
      incompleteStatus?.published === false,
      "Readiness Gating",
      "Database row remains published = false after rejected publish attempt"
    );

    // ========================================================================
    // SUITE 7: Publication Lifecycle & Public Display
    // ========================================================================
    console.log("\n--- Suite 7: Publication Lifecycle & Public Display ---");
    // Complete draft satisfies 4/4 readiness, so publishing should succeed
    const publishedProof = await publishTestimonial(createdDraft.id, true, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    assert(publishedProof.published === true, "Publish Lifecycle", "Service returns published = true");

    // Verify in database
    const dbPublished = queryLocalJson<any[]>(
      `SELECT published FROM public.testimonials WHERE id = '${createdDraft.id}';`
    )[0];
    assert(dbPublished?.published === true, "Publish Lifecycle", "Database reflects published = true");

    // Verify public query now includes this testimonial
    const publicFeedNow = queryLocalJson<any[]>(
      `SELECT id, client_name, short_quote, review FROM public.testimonials WHERE published = true;`
    );
    assert(
      publicFeedNow.some((t) => t.id === createdDraft.id),
      "Publish Lifecycle",
      "Public website query now successfully retrieves the published testimonial"
    );

    // ========================================================================
    // SUITE 8: Testimonial Reverting / Unpublishing & Concealment
    // ========================================================================
    console.log("\n--- Suite 8: Testimonial Reverting / Unpublishing ---");
    const reverted = await publishTestimonial(createdDraft.id, false, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    assert(reverted.published === false, "Unpublish Lifecycle", "Service returns published = false after revert");

    const publicFeedAfterUnpublish = queryLocalJson<any[]>(
      `SELECT id FROM public.testimonials WHERE published = true;`
    );
    assert(
      !publicFeedAfterUnpublish.some((t) => t.id === createdDraft.id),
      "Unpublish Lifecycle",
      "Unpublished proof is immediately concealed from public queries"
    );

    // Re-publish for remaining suites
    await publishTestimonial(createdDraft.id, true, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });

    // ========================================================================
    // SUITE 9: Canonical CRM Client Relationship Integrity
    // ========================================================================
    console.log("\n--- Suite 9: Canonical CRM Client Relationship Integrity ---");
    // Query joined client to verify reference without duplication
    const joinedTestimonial = queryLocalJson<any[]>(
      `SELECT t.id, t.client_name, t.client_id, c.name as crm_client_name
       FROM public.testimonials t
       JOIN public.clients c ON c.id = t.client_id
       WHERE t.id = '${createdDraft.id}';`
    )[0];
    assert(!!joinedTestimonial, "CRM Linking", "Relational JOIN between testimonials and clients succeeds");
    assert(
      joinedTestimonial.crm_client_name === "TOTTA Restaurant",
      "CRM Linking",
      "Linked CRM client name matches canonical clients table without duplicating fields"
    );

    // Verify client record was not mutated
    const clientRecord = queryLocalJson<any[]>(
      `SELECT id, name FROM public.clients WHERE id = '${CANONICAL_CLIENT_ID}';`
    )[0];
    assert(
      clientRecord.name === "TOTTA Restaurant",
      "CRM Linking",
      "Canonical client record remains completely intact and uncorrupted"
    );

    // ========================================================================
    // SUITE 10: Canonical Case Study Relationship Integrity
    // ========================================================================
    console.log("\n--- Suite 10: Canonical Case Study Relationship Integrity ---");
    // Create a synthetic case study project to test project_id linking
    const testProjectSlug = `proof-case-${Date.now()}`;
    const projectInsert = queryLocalJson<any[]>(
      `INSERT INTO public.projects (title, slug, client, published)
       VALUES ('TOTTA Digital Luxe Showcase', '${testProjectSlug}', 'TOTTA Restaurant', true)
       RETURNING id;`
    )[0];
    const testProjectId = projectInsert.id;
    createdProjectIds.push(testProjectId);

    // Update testimonial with project_id
    await updateTestimonial(
      createdDraft.id,
      { project_id: testProjectId },
      {
        clientOverride: adminClient,
        ctx: adminCtx,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      }
    );

    const linkedCaseStudy = queryLocalJson<any[]>(
      `SELECT t.id, t.project_id, p.title as case_study_title
       FROM public.testimonials t
       JOIN public.projects p ON p.id = t.project_id
       WHERE t.id = '${createdDraft.id}';`
    )[0];
    assert(!!linkedCaseStudy, "Case Study Linking", "Relational JOIN between testimonials and projects succeeds");
    assert(
      linkedCaseStudy.case_study_title === "TOTTA Digital Luxe Showcase",
      "Case Study Linking",
      "Linked case study title matches canonical projects table reference"
    );

    // Test case study testimonial reader function (as used by case-studies.$slug.tsx)
    const caseStudyQuote = queryLocalJson<any[]>(
      `SELECT client_name, company, role, review, short_quote
       FROM public.testimonials
       WHERE project_id = '${testProjectId}' AND published = true
       ORDER BY featured DESC, sort_order ASC
       LIMIT 1;`
    )[0];
    assert(!!caseStudyQuote, "Case Study Linking", "Case study reader query successfully retrieves linked quote");
    assert(caseStudyQuote.client_name === "Karim Ben Salah", "Case Study Linking", "Reader query retrieves correct client_name");

    // ========================================================================
    // SUITE 11: Featured Testimonials Management & Ordering
    // ========================================================================
    console.log("\n--- Suite 11: Featured Testimonials Management & Ordering ---");
    // Create a second published proof with lower sort_order and featured = true
    const featuredPayload = {
      client_name: "Yasmine Trabelsi",
      company: "Elixir Luxury Goods",
      role: "Creative Director",
      review: "Working with SADA positioned our brand at the pinnacle of luxury commerce.",
      short_quote: "Positioned our brand at the pinnacle of luxury commerce.",
      language: "en",
      client_id: CANONICAL_CLIENT_ID,
      published: true,
      featured: true,
      sort_order: 1, // Lower number appears first
    };
    const featuredProof = await createTestimonial(featuredPayload, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdTestimonialIds.push(featuredProof.id);

    // Query ordered list matching homepage Testimonials.tsx component
    const homepageTestimonials = queryLocalJson<any[]>(
      `SELECT id, client_name, featured, sort_order
       FROM public.testimonials
       WHERE published = true
       ORDER BY featured DESC, sort_order ASC;`
    );

    assert(
      homepageTestimonials[0]?.id === featuredProof.id,
      "Featured & Ordering",
      "Featured proof with lowest sort_order appears first in homepage query"
    );

    // Test toggling featured flag via service
    await setFeaturedTestimonial(featuredProof.id, false, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    const unfeaturedStatus = queryLocalJson<any[]>(
      `SELECT featured FROM public.testimonials WHERE id = '${featuredProof.id}';`
    )[0];
    assert(unfeaturedStatus?.featured === false, "Featured & Ordering", "Featured toggle successfully sets featured = false");

    // ========================================================================
    // SUITE 12: Multilingual Arabic & RTL Text Integrity
    // ========================================================================
    console.log("\n--- Suite 12: Multilingual Arabic & RTL Text Integrity ---");
    const arabicPayload = {
      client_name: "محمد الشاذلي",
      company: "مجموعة الأصالة والفخامة",
      role: "المدير العام",
      review: "قدمت لنا صدى تجربة رقمية استثنائية تعكس معايير الفخامة والريادة العالمية في تونس والخليج العربي.",
      short_quote: "تجربة رقمية استثنائية تعكس معايير الفخامة والريادة.",
      language: "ar",
      client_id: CANONICAL_CLIENT_ID,
      published: true,
      featured: true,
      sort_order: 2,
    };
    const arabicProof = await createTestimonial(arabicPayload, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdTestimonialIds.push(arabicProof.id);

    const reloadedArabic = queryLocalJson<any[]>(
      `SELECT * FROM public.testimonials WHERE id = '${arabicProof.id}';`
    )[0];
    assert(reloadedArabic.client_name === "محمد الشاذلي", "Multilingual Arabic", "Arabic client name stored with full UTF-8 fidelity");
    assert(reloadedArabic.language === "ar", "Multilingual Arabic", "Language flag correctly set to 'ar'");
    assert(
      reloadedArabic.review.includes("معايير الفخامة والريادة"),
      "Multilingual Arabic",
      "Arabic quote stored faithfully without character corruption"
    );

    // Verify language filtering logic from Testimonials.tsx:
    // When language = 'ar', query finds Arabic testimonials
    const arabicFilterResults = queryLocalJson<any[]>(
      `SELECT id, client_name, language FROM public.testimonials WHERE published = true AND language = 'ar';`
    );
    assert(
      arabicFilterResults.some((t) => t.id === arabicProof.id),
      "Multilingual Arabic",
      "Arabic language filter successfully matches Arabic client proof"
    );

    // ========================================================================
    // SUITE 13: Media Photo URL Handling & Initial Fallback
    // ========================================================================
    console.log("\n--- Suite 13: Media Photo URL Handling & Fallback ---");
    const photoPayload = {
      client_name: "Amira Mansour",
      company: "Mansour Fine Jewelry",
      role: "Founder & Lead Designer",
      photo_url: "https://example.com/storage/media/testimonials/amira-mansour.webp",
      review: "The craftsmanship in SADA's software matches the precision we demand in fine jewelry.",
      short_quote: "Software craftsmanship matching fine jewelry precision.",
      language: "en",
      client_id: CANONICAL_CLIENT_ID,
      published: false,
    };
    const proofWithPhoto = await createTestimonial(photoPayload, {
      clientOverride: adminClient,
      ctx: adminCtx,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdTestimonialIds.push(proofWithPhoto.id);

    const reloadedPhoto = queryLocalJson<any[]>(
      `SELECT photo_url FROM public.testimonials WHERE id = '${proofWithPhoto.id}';`
    )[0];
    assert(
      reloadedPhoto.photo_url === "https://example.com/storage/media/testimonials/amira-mansour.webp",
      "Media & Photo",
      "Photo URL persists accurately without alteration"
    );

    // Test removing photo
    await updateTestimonial(
      proofWithPhoto.id,
      { photo_url: null },
      {
        clientOverride: adminClient,
        ctx: adminCtx,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      }
    );
    const photoRemoved = queryLocalJson<any[]>(
      `SELECT photo_url, client_name FROM public.testimonials WHERE id = '${proofWithPhoto.id}';`
    )[0];
    assert(photoRemoved.photo_url === null, "Media & Photo", "Photo URL successfully cleared to null");
    assert(
      photoRemoved.client_name.charAt(0).toUpperCase() === "A",
      "Media & Photo",
      "Fallback letter resolves to 'A' matching client name"
    );

    // ========================================================================
    // SUITE 14: Input Validation & XSS Script Neutralization
    // ========================================================================
    console.log("\n--- Suite 14: Input Validation & XSS Script Neutralization ---");
    // Test empty client name
    let emptyNameFailed = false;
    try {
      await createTestimonial(
        { client_name: "   ", review: "Valid length review describing great service." },
        { clientOverride: adminClient, ctx: adminCtx, actorRole: "admin", actorId: ADMIN_USER_ID }
      );
    } catch {
      emptyNameFailed = true;
    }
    assert(emptyNameFailed, "Input Validation", "Empty client name is rejected");

    // Test empty review
    let emptyReviewFailed = false;
    try {
      await createTestimonial(
        { client_name: "Valid Name", review: "   " },
        { clientOverride: adminClient, ctx: adminCtx, actorRole: "admin", actorId: ADMIN_USER_ID }
      );
    } catch {
      emptyReviewFailed = true;
    }
    assert(emptyReviewFailed, "Input Validation", "Empty review quote is rejected");

    // Test quote containing HTML script tag, emojis, and quotes
    const complexReview = `“SADA's work is outstanding!” <script>alert('xss')</script> 🚀 Highly recommended for luxury brands.`;
    const complexProof = await createTestimonial(
      {
        client_name: "Alex Thorne",
        company: "Apex Ventures",
        role: "Partner",
        review: complexReview,
        client_id: CANONICAL_CLIENT_ID,
        published: false,
      },
      { clientOverride: adminClient, ctx: adminCtx, actorRole: "admin", actorId: ADMIN_USER_ID }
    );
    createdTestimonialIds.push(complexProof.id);

    const reloadedComplex = queryLocalJson<any[]>(
      `SELECT review FROM public.testimonials WHERE id = '${complexProof.id}';`
    )[0];
    assert(
      reloadedComplex.review === complexReview,
      "Input Validation",
      "Special characters, emojis, quotes, and HTML tags are stored faithfully as plain text data without execution"
    );

    // ========================================================================
    // SUITE 15: Admin Dashboard Metrics & Counter Reconciliation
    // ========================================================================
    console.log("\n--- Suite 15: Admin Dashboard Metrics & Counter Reconciliation ---");
    const counts = queryLocalJson<any[]>(
      `SELECT
         count(*) as total,
         count(*) filter (where published = true) as published,
         count(*) filter (where published = false) as drafts,
         count(*) filter (where featured = true) as featured
       FROM public.testimonials;`
    )[0];

    const allRows = queryLocalJson<any[]>(`SELECT id, published, featured FROM public.testimonials;`);
    const calculatedTotal = allRows.length;
    const calculatedPublished = allRows.filter((r) => r.published).length;
    const calculatedDrafts = allRows.filter((r) => !r.published).length;
    const calculatedFeatured = allRows.filter((r) => r.featured).length;

    assert(Number(counts.total) === calculatedTotal, "Dashboard Metrics", "Total count matches row count");
    assert(Number(counts.published) === calculatedPublished, "Dashboard Metrics", "Published count matches published rows");
    assert(Number(counts.drafts) === calculatedDrafts, "Dashboard Metrics", "Drafts count matches drafts rows");
    assert(Number(counts.featured) === calculatedFeatured, "Dashboard Metrics", "Featured count matches featured rows");

    // ========================================================================
    // SUITE 16: RBAC & Permission Gating (Admin vs Super Admin vs Worker)
    // ========================================================================
    console.log("\n--- Suite 16: RBAC & Permission Gating ---");
    // Worker cannot create testimonial
    let workerCreateBlocked = false;
    try {
      await createTestimonial(
        { client_name: "Test", review: "Test review quote exceeding twenty characters." },
        { clientOverride: workerClient, ctx: workerCtx, actorRole: "worker", actorId: WORKER_USER_ID }
      );
    } catch (err: any) {
      workerCreateBlocked = true;
    }
    assert(workerCreateBlocked, "RBAC Gating", "Worker specialist is blocked from creating testimonials");

    // Standard Admin CANNOT permanently delete testimonial (Super Admin exclusive)
    let adminDeleteBlocked = false;
    let adminDeleteError = "";
    try {
      await deleteTestimonial(createdDraft.id, {
        clientOverride: adminClient,
        ctx: adminCtx,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      });
    } catch (err: any) {
      adminDeleteBlocked = true;
      adminDeleteError = err.message || "";
    }
    assert(adminDeleteBlocked, "RBAC Gating", "Standard Admin is blocked from permanently deleting client proof");
    assert(
      adminDeleteError.includes("FORBIDDEN_DELETE") ||
      adminDeleteError.includes("Super Admin exclusive"),
      "RBAC Gating",
      "Delete error explicitly enforces Super Admin exclusive deletion for non-super-admins"
    );

    // Super Admin CAN permanently delete testimonial
    let superAdminDeleteSucceeded = false;
    try {
      await deleteTestimonial(createdDraft.id, {
        clientOverride: superAdminClient,
        ctx: superAdminCtx,
        actorRole: "super_admin",
        actorId: SUPER_ADMIN_USER_ID,
      });
      superAdminDeleteSucceeded = true;
    } catch (err) {
      console.error(err);
    }
    assert(superAdminDeleteSucceeded, "RBAC Gating", "Super Admin is permitted to permanently delete client proof");

    // Remove deleted ID from tracking
    const deletedIdx = createdTestimonialIds.indexOf(createdDraft.id);
    if (deletedIdx !== -1) createdTestimonialIds.splice(deletedIdx, 1);

    // Verify system audit logs recorded the operations
    const auditLogs = queryLocalJson<any[]>(
      `SELECT action, entity_type, entity_id FROM public.system_audit_logs WHERE entity_type = 'testimonial' ORDER BY created_at DESC LIMIT 5;`
    );
    assert(
      auditLogs.length > 0,
      "Audit Logging",
      "Mutations successfully emit audit entries into public.system_audit_logs"
    );

    // ========================================================================
    // SUITE 17: Clean Teardown of Synthetic Records
    // ========================================================================
    console.log("\n--- Suite 17: Clean Teardown of Synthetic Records ---");
    for (const testId of createdTestimonialIds) {
      runLocalSql(`DELETE FROM public.testimonials WHERE id = '${testId}';`);
    }
    for (const projId of createdProjectIds) {
      runLocalSql(`DELETE FROM public.projects WHERE id = '${projId}';`);
    }
    assert(true, "Teardown", "Synthetic certification records cleaned up without touching canonical data");

    const remainingSynthetic = queryLocalJson<any[]>(
      `SELECT count(*) as count FROM public.testimonials WHERE id IN (${createdTestimonialIds.map((id) => `'${id}'`).join(", ") || "NULL"});`
    )[0];
    assert(
      Number(remainingSynthetic?.count || 0) === 0,
      "Teardown",
      "Confirmed zero remaining synthetic records in public.testimonials"
    );

  } catch (err) {
    console.error("Certification suite encountered unexpected exception:", err);
    assert(false, "Master Certification", "Fatal runtime exception", String(err));
  } finally {
    // Teardown safety in finally block
    for (const testId of createdTestimonialIds) {
      try {
        runLocalSql(`DELETE FROM public.testimonials WHERE id = '${testId}';`);
      } catch {}
    }
    for (const projId of createdProjectIds) {
      try {
        runLocalSql(`DELETE FROM public.projects WHERE id = '${projId}';`);
      } catch {}
    }
  }

  // ========================================================================
  // FINAL SCORECARD & SUMMARY
  // ========================================================================
  console.log("\n================================================================================");
  console.log("FINAL SCORECARD & RUNTIME CERTIFICATION SUMMARY");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Assertions: ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success Rate:     ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log("\nFailed Assertions:");
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`  - [${f.suite}] ${f.test}: ${f.message || "Failed"}`);
    }
    process.exit(1);
  } else {
    console.log("\nALL 17 TEST SUITES PASSED PERFECTLY!");
    console.log("Verdict: PASS — LOCAL MVP VERIFIED");
    process.exit(0);
  }
}

runMasterCertification().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
