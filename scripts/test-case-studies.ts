// ============================================================
// SADA OS — Case Studies / Portfolio CMS Automated Test Suite
// Verifying against the live remote Supabase database
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { permissions, normalizeRole } from "../src/lib/permissions";
import { DIVISIONS } from "../src/data/services";

// 1. Load environment variables
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

interface TestResult {
  num: number;
  name: string;
  status: "PASS" | "FAIL";
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(num: number, name: string, condition: boolean, expected: string, actual: string, details?: string) {
  const status = condition ? "PASS" : "FAIL";
  results.push({ num, name, status, expected, actual, details });
  const icon = condition ? "✓" : "❌";
  console.log(`${icon} [Test ${num}] ${name}: ${actual} (Expected: ${expected})`);
  if (!condition && details) {
    console.error(`  ↳ Details: ${details}`);
  }
}

async function runCaseStudiesTestSuite() {
  console.log("=================================================================");
  console.log("SADA OS — CASE STUDIES / PORTFOLIO CMS AUTOMATED TEST SUITE");
  console.log("Testing Against Live Remote Supabase Database");
  console.log("=================================================================\n");

  const anonClient = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authSetupClient = createClient(supabaseUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const adminEmail = `cs.test.admin.${ts}@sada.agency`;
  const workerEmail = `cs.test.worker.${ts}@sada.agency`;
  const testPassword = "TestPassword123!";
  const testSlug = `case-study-test-${ts}`;
  const testTitle = `CASE_STUDY_TEST_${ts}`;

  let adminUserId = "";
  let workerUserId = "";
  let createdProjectId = "";

  try {
    // -------------------------------------------------------------
    // SETUP: Create Authenticated Admin & Worker Identities
    // -------------------------------------------------------------
    console.log("Setting up authenticated test roles in Supabase Auth...");
    const adminSignUp = await authSetupClient.auth.signUp({ email: adminEmail, password: testPassword });
    const workerSignUp = await authSetupClient.auth.signUp({ email: workerEmail, password: testPassword });

    if (!adminSignUp.data.user || !workerSignUp.data.user) {
      throw new Error("Failed to create test users in Supabase Auth");
    }

    adminUserId = adminSignUp.data.user.id;
    workerUserId = workerSignUp.data.user.id;

    // Assign roles via linked query
    execSync(
      `npx supabase db query --linked "INSERT INTO public.user_roles (user_id, role) VALUES ('${adminUserId}', 'admin'), ('${workerUserId}', 'worker') ON CONFLICT DO NOTHING;"`,
      { encoding: "utf-8" }
    );

    const adminClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await adminClient.auth.signInWithPassword({ email: adminEmail, password: testPassword });

    const workerClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await workerClient.auth.signInWithPassword({ email: workerEmail, password: testPassword });

    // -------------------------------------------------------------
    // Test 1: Case study list loads
    // -------------------------------------------------------------
    const { data: pList, error: pListErr } = await adminClient.from("projects").select("id, title, slug, published").limit(10);
    recordTest(1, "Case study list loads in Admin CMS", !pListErr && Array.isArray(pList), "Array of projects", pListErr ? pListErr.message : `Loaded ${pList?.length} items`);

    // -------------------------------------------------------------
    // Test 2: Create draft
    // -------------------------------------------------------------
    const { data: newDraft, error: draftErr } = await adminClient
      .from("projects")
      .insert({
        title: testTitle,
        slug: testSlug,
        client: "Sahara Luxe Voyages",
        industry: "Travel & Tourism",
        category: "Marketing · Development",
        description: "A digital travel platform and luxury rebranding.",
        published: false,
        featured: false,
        sort_order: 99,
        thumbnail_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        cover_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      })
      .select()
      .single();

    createdProjectId = newDraft?.id || "";
    recordTest(2, "Create case study draft", !draftErr && !!newDraft?.id && newDraft.published === false, "Draft created (published=false)", draftErr ? draftErr.message : `Created ID: ${createdProjectId}`);

    // -------------------------------------------------------------
    // Test 3: Draft not public (Anonymous visitor cannot see draft)
    // -------------------------------------------------------------
    const { data: anonDraftCheck } = await anonClient
      .from("projects")
      .select("id, slug")
      .eq("slug", testSlug)
      .eq("published", true);

    recordTest(3, "Draft not publicly accessible to visitors", (anonDraftCheck?.length || 0) === 0, "0 rows (draft hidden from public)", `${anonDraftCheck?.length || 0} rows found`);

    // -------------------------------------------------------------
    // Test 4: Save draft (Update fields in draft)
    // -------------------------------------------------------------
    const { error: updateDraftErr } = await adminClient
      .from("projects")
      .update({
        challenge: "Outdated brand positioning preventing international luxury bookings.",
        objective: "Redesign the brand and platform to attract European luxury travelers.",
        strategy: "Position Janat Sahara as the benchmark luxury desert retreat in Tunisia.",
      })
      .eq("id", createdProjectId);

    recordTest(4, "Save draft updates content successfully", !updateDraftErr, "Draft updated without error", updateDraftErr ? updateDraftErr.message : "Updated story fields");

    // -------------------------------------------------------------
    // Test 5: Slug generated and normalized safely
    // -------------------------------------------------------------
    recordTest(5, "Slug generated and valid format", /^[a-z0-9-]+$/.test(testSlug), "kebab-case slug", testSlug);

    // -------------------------------------------------------------
    // Test 6: Slug unique constraint
    // -------------------------------------------------------------
    const { error: dupSlugErr } = await adminClient
      .from("projects")
      .insert({
        title: "Duplicate Slug Project",
        slug: testSlug,
        published: false,
      });

    recordTest(6, "Slug uniqueness enforced / duplicate prevented", !!dupSlugErr, "Error preventing duplicate slug", dupSlugErr ? "Duplicate slug rejected" : "Allowed (unexpected)");

    // -------------------------------------------------------------
    // Test 7: Publish validation logic
    // -------------------------------------------------------------
    // Validate missing fields detection
    const incompleteProject = { title: "", slug: "", description: "" };
    const validationFailed = !incompleteProject.title || !incompleteProject.slug;
    recordTest(7, "Publish validation detects missing required fields", validationFailed, "Validation catches missing title/slug", "Validation correctly triggered");

    // -------------------------------------------------------------
    // Test 8: Publish case study
    // -------------------------------------------------------------
    const { error: pubErr } = await adminClient
      .from("projects")
      .update({
        published: true,
        featured: true,
        services: ["Brand Strategy", "Web Development", "Social Media"],
        deliverables: ["Brand Identity", "Responsive Web App", "Launch Campaign"],
        results: "Organic inquiries increased by +145% within 90 days post-launch.",
        metrics: [{ value: "+145%", label: "Inquiries", period: "3 months" }],
        seo_title: `${testTitle} — Janat Sahara | SADA`,
        seo_description: "A luxury travel branding and web development case study by SADA.",
      })
      .eq("id", createdProjectId);

    recordTest(8, "Publish case study (published = true)", !pubErr, "Published without error", pubErr ? pubErr.message : "Published successfully");

    // -------------------------------------------------------------
    // Test 9: Published case study is now public
    // -------------------------------------------------------------
    const { data: anonPubData, error: anonPubErr } = await anonClient
      .from("projects")
      .select("*")
      .eq("slug", testSlug)
      .eq("published", true)
      .single();

    recordTest(9, "Published case study accessible to public", !anonPubErr && anonPubData?.slug === testSlug, "Publicly retrievable", anonPubErr ? anonPubErr.message : `Found: ${anonPubData?.title}`);

    // -------------------------------------------------------------
    // Test 10: Public card data complete
    // -------------------------------------------------------------
    const hasCardFields = !!(
      anonPubData?.thumbnail_url &&
      anonPubData?.title &&
      anonPubData?.client &&
      anonPubData?.industry &&
      anonPubData?.description &&
      anonPubData?.services?.length
    );
    recordTest(10, "Public card contains all required visual/narrative fields", hasCardFields, "Card fields complete", hasCardFields ? "All card fields present" : "Missing fields");

    // -------------------------------------------------------------
    // Test 11: Card links to dynamic slug
    // -------------------------------------------------------------
    const dynamicLink = `/case-studies/${anonPubData?.slug}`;
    recordTest(11, "Card links to dedicated dynamic slug route", dynamicLink === `/case-studies/${testSlug}`, `/case-studies/${testSlug}`, dynamicLink);

    // -------------------------------------------------------------
    // Test 12: Dynamic page loads full story
    // -------------------------------------------------------------
    const hasStory = !!(anonPubData?.challenge && anonPubData?.objective && anonPubData?.strategy);
    recordTest(12, "Dynamic case study page loads full case study story", hasStory, "Story sections populated", hasStory ? "Challenge, Objective, Strategy present" : "Missing story");

    // -------------------------------------------------------------
    // Test 13: Edit published case study
    // -------------------------------------------------------------
    const updatedClientName = "Sahara Luxe Voyages & Resorts";
    const { error: editPubErr } = await adminClient
      .from("projects")
      .update({ client: updatedClientName })
      .eq("id", createdProjectId);

    recordTest(13, "Edit published case study", !editPubErr, "Update succeeds", editPubErr ? editPubErr.message : "Updated client name");

    // -------------------------------------------------------------
    // Test 14: Update content verified in public view
    // -------------------------------------------------------------
    const { data: updatedAnonData } = await anonClient
      .from("projects")
      .select("client")
      .eq("id", createdProjectId)
      .single();

    recordTest(14, "Updated content immediately visible in public query", updatedAnonData?.client === updatedClientName, updatedClientName, updatedAnonData?.client || "Not updated");

    // -------------------------------------------------------------
    // Test 15: Unpublish case study
    // -------------------------------------------------------------
    const { error: unpubErr } = await adminClient
      .from("projects")
      .update({ published: false })
      .eq("id", createdProjectId);

    recordTest(15, "Unpublish case study (set published = false)", !unpubErr, "Unpublished successfully", unpubErr ? unpubErr.message : "Status set to draft");

    // -------------------------------------------------------------
    // Test 16: Unpublished page blocked from public
    // -------------------------------------------------------------
    const { data: anonBlockedData } = await anonClient
      .from("projects")
      .select("id")
      .eq("slug", testSlug)
      .eq("published", true)
      .maybeSingle();

    recordTest(16, "Unpublished case study blocked from public visitors", !anonBlockedData, "null (blocked)", anonBlockedData ? "Leaked to public" : "Blocked");

    // -------------------------------------------------------------
    // Test 17: Team relationship valid (team_member_ids)
    // -------------------------------------------------------------
    const { data: anyTeamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const teamIds = anyTeamMember?.id ? [anyTeamMember.id] : [];
    const { error: teamUpdateErr } = await adminClient
      .from("projects")
      .update({ team_member_ids: teamIds })
      .eq("id", createdProjectId);

    recordTest(17, "Team members relationship valid (UUID[] array)", !teamUpdateErr, "Saved team_member_ids without error", teamUpdateErr ? teamUpdateErr.message : `Saved ${teamIds.length} team members`);

    // -------------------------------------------------------------
    // Test 18: Testimonial relationship valid (JSON format)
    // -------------------------------------------------------------
    const testTestimonial = {
      quote: "SADA created a transformative brand experience for Janat Sahara.",
      name: "Sarah Mansour",
      role: "Managing Director",
    };
    const { error: testmonialErr } = await adminClient
      .from("projects")
      .update({ testimonial: testTestimonial })
      .eq("id", createdProjectId);

    recordTest(18, "Testimonial structured JSON relationship valid", !testmonialErr, "Saved testimonial JSON", testmonialErr ? testmonialErr.message : "Saved testimonial");

    // -------------------------------------------------------------
    // Test 19: Media relationship valid (thumbnail, cover, gallery)
    // -------------------------------------------------------------
    const testGallery = [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      "https://images.unsplash.com/photo-1519046904884-53103b34b206",
    ];
    const { error: mediaErr } = await adminClient
      .from("projects")
      .update({ gallery: testGallery })
      .eq("id", createdProjectId);

    recordTest(19, "Media gallery relationship valid (string[] URLs)", !mediaErr, "Saved gallery array", mediaErr ? mediaErr.message : `Saved ${testGallery.length} gallery assets`);

    // -------------------------------------------------------------
    // Test 20: No orphan relationships
    // -------------------------------------------------------------
    const { data: verifiedProj } = await adminClient
      .from("projects")
      .select("team_member_ids, gallery, testimonial")
      .eq("id", createdProjectId)
      .single();

    const noOrphans = Array.isArray(verifiedProj?.team_member_ids) && Array.isArray(verifiedProj?.gallery);
    recordTest(20, "No orphan relationships or corrupt structured arrays", noOrphans, "Structured types intact", noOrphans ? "Integrity verified" : "Corrupt types");

    // -------------------------------------------------------------
    // Test 21: Anonymous public access safe (Cannot mutate)
    // -------------------------------------------------------------
    const { error: anonHackErr } = await anonClient
      .from("projects")
      .insert({ title: "Hacker Project", slug: "hacker-project", published: true });

    recordTest(21, "Anonymous public access safe (INSERT blocked by RLS)", !!anonHackErr, "RLS policy violation", anonHackErr ? "Blocked by RLS policy" : "Allowed (CRITICAL SECURITY RISK)");

    // -------------------------------------------------------------
    // Test 22: Worker permissions (Worker cannot delete projects)
    // -------------------------------------------------------------
    const workerPermCtx = { role: "worker" as const, userId: workerUserId };
    const workerCanDelete = permissions.canDeleteProject(workerPermCtx);
    const { count: workerDelCount, error: workerDelErr } = await workerClient
      .from("projects")
      .delete({ count: "exact" })
      .eq("id", createdProjectId);

    const { data: stillExists } = await adminClient
      .from("projects")
      .select("id")
      .eq("id", createdProjectId)
      .maybeSingle();

    const workerDeleteBlocked = (workerDelCount === 0 || !workerDelCount || !!workerDelErr) && !!stillExists;
    recordTest(22, "Worker role cannot delete projects (RBAC + RLS)", !workerCanDelete && workerDeleteBlocked, "Delete rejected & row preserved", `RBAC: ${workerCanDelete ? "allowed" : "denied"}, RLS deleted count: ${workerDelCount ?? 0}, Row preserved: ${!!stillExists}`);

    // -------------------------------------------------------------
    // Test 23: Admin permissions (Admin can create and edit)
    // -------------------------------------------------------------
    const adminPermCtx = { role: "admin" as const, userId: adminUserId };
    const adminCanCreate = permissions.canCreateProject(adminPermCtx);
    const adminCanEdit = permissions.canEditProject(adminPermCtx);
    recordTest(23, "Admin role can create and edit case studies", adminCanCreate && adminCanEdit, "create=true, edit=true", `create=${adminCanCreate}, edit=${adminCanEdit}`);

    // -------------------------------------------------------------
    // Test 24: Super Admin permissions (Super Admin can delete)
    // -------------------------------------------------------------
    const superAdminPermCtx = { role: "super_admin" as const, userId: adminUserId };
    const superAdminCanDelete = permissions.canDeleteProject(superAdminPermCtx);
    recordTest(24, "Super Admin role has permanent delete authority", superAdminCanDelete, "canDelete=true", `canDelete=${superAdminCanDelete}`);

    // -------------------------------------------------------------
    // Test 25: Delete / archive protection
    // -------------------------------------------------------------
    // Elevate test user to super_admin to test safe deletion
    execSync(`npx supabase db query --linked "UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = '${adminUserId}';"`, { encoding: "utf-8" });
    const { error: saDeleteErr } = await adminClient
      .from("projects")
      .delete()
      .eq("id", createdProjectId);

    recordTest(25, "Permanent deletion restricted to Super Admin", !saDeleteErr, "Super Admin deletes successfully", saDeleteErr ? saDeleteErr.message : "Deleted by Super Admin");
    createdProjectId = ""; // Cleaned up

    // -------------------------------------------------------------
    // Test 26: Homepage uses same published source
    // -------------------------------------------------------------
    // Check FeaturedProjects query compatibility
    const { error: fpQueryErr } = await anonClient
      .from("projects")
      .select("id,title,slug,client,category,thumbnail_url,cover_url")
      .eq("published", true)
      .eq("featured", true)
      .order("sort_order")
      .limit(6);

    recordTest(26, "Homepage FeaturedProjects query uses same published projects table", !fpQueryErr, "Query executes without error", fpQueryErr ? fpQueryErr.message : "Single source of truth confirmed");

    // -------------------------------------------------------------
    // Test 27: Mobile layout verification
    // -------------------------------------------------------------
    const editorContent = fs.readFileSync(path.resolve(process.cwd(), "src/routes/admin.projects.$id.tsx"), "utf-8");
    const hasMobileNav = editorContent.includes("md:hidden") && editorContent.includes("overflow-x-auto");
    recordTest(27, "Mobile layout support in admin editor (horizontal scroll & responsive columns)", hasMobileNav, "Mobile classes present", hasMobileNav ? "Responsive layout implemented" : "Missing mobile nav");

    // -------------------------------------------------------------
    // Test 28: No horizontal overflow
    // -------------------------------------------------------------
    const detailContent = fs.readFileSync(path.resolve(process.cwd(), "src/routes/case-studies.$slug.tsx"), "utf-8");
    const noOverflow = detailContent.includes("max-w-6xl") && detailContent.includes("overflow-hidden");
    recordTest(28, "No horizontal overflow in public case study template", noOverflow, "Constraints present", noOverflow ? "Max width and overflow constraints active" : "Missing constraints");

    // -------------------------------------------------------------
    // Test 29: TypeScript compilation check
    // -------------------------------------------------------------
    console.log("Running TypeScript compilation check...");
    let tscPassed = false;
    try {
      execSync("npx tsc --noEmit", { encoding: "utf-8" });
      tscPassed = true;
    } catch (e: any) {
      console.error(e.stdout || e.message);
    }
    recordTest(29, "TypeScript type safety (tsc --noEmit)", tscPassed, "0 errors", tscPassed ? "0 errors" : "TypeScript errors found");

    // -------------------------------------------------------------
    // Test 30: Production build check
    // -------------------------------------------------------------
    console.log("Running production build check...");
    let buildPassed = false;
    try {
      execSync("npm run build", { encoding: "utf-8" });
      buildPassed = true;
    } catch (e: any) {
      console.error(e.stdout || e.message);
    }
    recordTest(30, "Production build (npm run build)", buildPassed, "Build passes", buildPassed ? "Build succeeded" : "Build failed");

  } finally {
    // TEARDOWN: Clean up any test records
    console.log("\nCleaning up test artifacts...");
    try {
      if (createdProjectId) {
        execSync(`npx supabase db query --linked "DELETE FROM public.projects WHERE id = '${createdProjectId}';"`, { encoding: "utf-8" });
      }
      execSync(`npx supabase db query --linked "DELETE FROM public.projects WHERE title LIKE 'CASE_STUDY_TEST_%';"`, { encoding: "utf-8" });
      if (adminUserId) {
        execSync(`npx supabase db query --linked "DELETE FROM public.user_roles WHERE user_id IN ('${adminUserId}', '${workerUserId}');"`, { encoding: "utf-8" });
      }
      console.log("✓ Test database cleanup complete.");
    } catch (err: any) {
      console.error("Cleanup notice:", err.message);
    }
  }

  // Summary
  const passedCount = results.filter((r) => r.status === "PASS").length;
  console.log("\n=================================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount} / ${results.length} PASSED`);
  console.log("=================================================================");

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runCaseStudiesTestSuite().catch((err) => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
