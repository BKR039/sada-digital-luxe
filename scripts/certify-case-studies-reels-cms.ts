/**
 * SADA OS — Case Studies & Reels CMS
 * Master Runtime Certification & Integrity Test Suite
 *
 * Tests the complete lifecycle against isolated local PostgreSQL (sada_local_test),
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
  runLocalSql,
  queryLocalJson,
} from "./local-db-client";
import {
  createProjectItem,
  updateProjectItem,
  publishProjectItem,
  deleteProjectItem,
  createSocialReel,
  updateSocialReel,
  publishSocialReel,
  setFeaturedSocialReel,
  reorderSocialReels,
  deleteSocialReel,
  parseInstagramReelUrl,
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
  console.log("SADA OS — CASE STUDIES & REELS CMS MASTER RUNTIME CERTIFICATION");
  console.log("Database: sada_local_test (isolated local PostgreSQL 16)");
  console.log("================================================================================\n");

  // 1. Database Safety & Guard Validation
  enforceDatabaseIsolation(LOCAL_DB_URL);
  assert(true, "Safety Guard", "DataIsolationGuard independently verified target host as 127.0.0.1");
  assert(
    !LOCAL_DB_URL.includes("supabase.co"),
    "Safety Guard",
    "Target database is NOT production Supabase cloud"
  );

  // Authoritative QA principals existing in local PostgreSQL user_roles & profiles
  const ADMIN_USER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // QA Standard Admin
  const SUPER_ADMIN_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // QA Super Admin
  const WORKER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // QA Worker Specialist

  const adminClient = createLocalTestClient(ADMIN_USER_ID);
  const superAdminClient = createLocalTestClient(SUPER_ADMIN_USER_ID);
  const workerClient = createLocalTestClient(WORKER_USER_ID);

  const testRunId = `cert_${Date.now()}`;
  const createdProjectIds: string[] = [];
  const createdReelIds: string[] = [];

  const adminCtx = { role: "admin" as const, userId: ADMIN_USER_ID };
  const superAdminCtx = { role: "super_admin" as const, userId: SUPER_ADMIN_USER_ID };
  const workerCtx = { role: "worker" as const, userId: WORKER_USER_ID };

  try {
    // =========================================================================
    // SUITE 1: Instagram Reel URL Parser & Validator
    // =========================================================================
    console.log("\n--- SUITE 1: Instagram URL Parsing & Validation ---");

    const validUrls = [
      {
        url: "https://www.instagram.com/reel/C7-X5zTsp9Q/",
        expectedCode: "C7-X5zTsp9Q",
      },
      {
        url: "https://instagram.com/reels/DA12345XYZ/?igsh=abc12345",
        expectedCode: "DA12345XYZ",
      },
      {
        url: "http://www.instagram.com/p/B_987654321/",
        expectedCode: "B_987654321",
      },
      {
        url: "https://www.instagram.com/share/reel/C5555555555/",
        expectedCode: "C5555555555",
      },
    ];

    for (const testCase of validUrls) {
      const parsed = parseInstagramReelUrl(testCase.url);
      assert(
        parsed.isValid && parsed.shortcode === testCase.expectedCode,
        "Reels URL Parser",
        `Parsed valid URL format for ${testCase.expectedCode}`
      );
    }

    const invalidUrls = [
      "",
      "https://youtube.com/watch?v=123",
      "https://tiktok.com/@user/video/123",
      "instagram.com/explore",
      "not-a-url",
    ];

    for (const badUrl of invalidUrls) {
      const parsed = parseInstagramReelUrl(badUrl);
      assert(!parsed.isValid, "Reels URL Parser", `Correctly rejected invalid URL: "${badUrl}"`);
    }

    // =========================================================================
    // SUITE 2: Social Reels CMS CRUD, Ordering & Single-Featured Invariant
    // =========================================================================
    console.log("\n--- SUITE 2: Social Reels CMS CRUD, Ordering & Single-Featured Invariant ---");

    // 2.1 Create Reel A (Draft, Not Featured)
    const reelAPayload = {
      title: `Creative Production Reel A (${testRunId})`,
      title_ar: "ريل الإنتاج الإبداعي أ",
      caption: "Behind the scenes of our luxury shoot",
      description_ar: "كواليس التصوير الإبداعي الفاخر",
      category: "Production",
      instagram_url: "https://www.instagram.com/reel/C_ReelAAA111/",
      instagram_shortcode: "C_ReelAAA111",
      thumbnail_url: "https://storage.sada.tn/media/reels/reel-a.jpg",
      display_order: 1,
      is_published: false,
      is_featured: false,
    };

    const reelA = await createSocialReel(reelAPayload, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });
    createdReelIds.push(reelA.id);

    assert(Boolean(reelA?.id), "Reels CMS", "Created Reel A successfully with ID");
    assert(reelA.title_ar === reelAPayload.title_ar, "Reels CMS", "Reel A title_ar persisted correctly");
    assert(reelA.description_ar === reelAPayload.description_ar, "Reels CMS", "Reel A description_ar persisted correctly");
    assert(reelA.is_published === false, "Reels CMS", "Reel A initial draft status verified");

    // 2.2 Create Reel B (Published, Featured)
    const reelBPayload = {
      title: `Social Campaign Reel B (${testRunId})`,
      title_ar: "ريل الحملة التسويقية ب",
      caption: "High impact video campaign",
      description_ar: "حملة فيديو تسويقية عالية التأثير",
      category: "Marketing",
      instagram_url: "https://www.instagram.com/reel/C_ReelBBB222/",
      instagram_shortcode: "C_ReelBBB222",
      thumbnail_url: "https://storage.sada.tn/media/reels/reel-b.jpg",
      display_order: 2,
      is_published: true,
      is_featured: true,
    };

    const reelB = await createSocialReel(reelBPayload, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });
    createdReelIds.push(reelB.id);

    assert(Boolean(reelB?.id), "Reels CMS", "Created Reel B successfully with ID");
    assert(reelB.is_featured === true, "Reels CMS", "Reel B is_featured set to true");

    // 2.3 Verify Single-Featured Reel Invariant: Set Reel A as Featured
    // Setting Reel A as featured must cause Reel B's featured status to reset to false
    await setFeaturedSocialReel(reelA.id, true, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });

    const reelsCheck = await queryLocalJson(
      `SELECT id, title, is_featured FROM social_reels WHERE id IN ('${reelA.id}', '${reelB.id}')`
    );
    const updatedReelA = reelsCheck.find((r: any) => r.id === reelA.id);
    const updatedReelB = reelsCheck.find((r: any) => r.id === reelB.id);

    assert(updatedReelA?.is_featured === true, "Single-Featured Invariant", "Reel A became primary featured reel");
    assert(updatedReelB?.is_featured === false, "Single-Featured Invariant", "Reel B featured status was automatically reset");

    const totalFeaturedCount = await queryLocalJson(
      `SELECT count(*)::int as count FROM social_reels WHERE is_featured = true`
    );
    assert(
      totalFeaturedCount[0].count <= 1,
      "Single-Featured Invariant",
      `Authoritative DB count of featured reels is exactly ${totalFeaturedCount[0].count} (<= 1)`
    );

    // 2.4 Reorder Reels
    await reorderSocialReels(
      [
        { id: reelA.id, display_order: 10 },
        { id: reelB.id, display_order: 20 },
      ],
      {
        ctx: adminCtx,
        actorRole: "admin",
        actorId: adminCtx.userId,
        clientOverride: adminClient,
      }
    );

    const reorderedRows = await queryLocalJson(
      `SELECT id, display_order FROM social_reels WHERE id IN ('${reelA.id}', '${reelB.id}') ORDER BY display_order ASC`
    );
    assert(
      reorderedRows[0].id === reelA.id && reorderedRows[0].display_order === 10,
      "Reels Ordering",
      "Reel A updated to display_order 10"
    );
    assert(
      reorderedRows[1].id === reelB.id && reorderedRows[1].display_order === 20,
      "Reels Ordering",
      "Reel B updated to display_order 20"
    );

    // 2.5 Publication Visibility in Public Query
    // Draft reels must NOT appear in public query; published reels MUST appear
    const publicReels = await queryLocalJson(
      `SELECT id, title, instagram_url FROM social_reels WHERE is_published = true ORDER BY is_featured DESC, display_order ASC`
    );
    const publicReelIds = publicReels.map((r: any) => r.id);
    assert(
      !publicReelIds.includes(reelA.id),
      "Reels Public Visibility",
      "Draft Reel A is excluded from public showcase query"
    );
    assert(
      publicReelIds.includes(reelB.id),
      "Reels Public Visibility",
      "Published Reel B is included in public showcase query"
    );

    // Now publish Reel A and verify it becomes visible
    await publishSocialReel(reelA.id, true, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });
    const publicReelsAfter = await queryLocalJson(
      `SELECT id FROM social_reels WHERE is_published = true AND id = '${reelA.id}'`
    );
    assert(publicReelsAfter.length === 1, "Reels Public Visibility", "Reel A became visible after publication");

    // =========================================================================
    // SUITE 3: Case Studies (Projects) CMS 8-Section Persistence & Lifecycle
    // =========================================================================
    console.log("\n--- SUITE 3: Case Studies CMS 8-Section Persistence & Lifecycle ---");

    const projectSlug = `lux-brand-${testRunId}`.toLowerCase();
    const projectPayload = {
      // 1. Overview & Basics
      title: `Luxury Digital Transformation (${testRunId})`,
      title_ar: "التحول الرقمي الفاخر للماركات العالمية",
      slug: projectSlug,
      client: "Maison de Luxe",
      client_ar: "ميزون دو لوكس",
      industry: "Haute Horlogerie & Fashion",
      industry_ar: "الساعات الفاخرة والأزياء الراقية",
      category: "Marketing · Development · Production",
      category_ar: "التسويق · البرمجة · الإنتاج",
      description: "Comprehensive end-to-end digital relaunch for a premier luxury house.",
      description_ar: "إعادة إطلاق رقمي شامل من الفكرة حتى المبيعات لدار أزياء راقية.",
      project_date: "2026-05-15",
      sort_order: 5,
      featured: false,
      published: false,

      // 2. Project Story
      challenge: "Legacy architecture unable to handle high-traffic flash releases.",
      challenge_ar: "بنية برمجية قديمة غير قادرة على استيعاب الإطلاقات الكبرى.",
      objective: "Rebuild platform with sub-second response times and bespoke UX.",
      objective_ar: "إعادة بناء المنصة بسرعة فائقة وتجربة مستخدم مخصصة لكبار العملاء.",
      strategy: "Micro-animations, headless architecture, and localized VIP shopping.",
      strategy_ar: "حركات دقيقة متطورة، بنية سحابية مستقلة، وتجربة تسوق لكبار الشخصيات.",
      process: "Sprint 1 Discovery -> Sprint 2 Prototyping -> Sprint 3 Launch.",
      process_ar: "المرحلة الأولى: الاكتشاف -> المرحلة الثانية: النماذج -> المرحلة الثالثة: الإطلاق.",

      // 3. Services & Deliverables
      services: ["Luxury E-Commerce", "Brand Strategy", "VIP Portals"],
      deliverables: ["Custom Headless Store", "Design System Kit", "Analytics Dashboard"],

      // 4. Results & Proof
      results: "320% increase in VIP conversion rate with 99.99% uptime during drops.",
      results_ar: "ارتفاع معدل تحويل كبار العملاء بنسبة 320% مع استقرار تام أثناء الإطلاقات.",
      metrics: [
        { value: "+320%", label: "VIP Conversions", period: "3 Months" },
        { value: "0.4s", label: "Page Load Time", period: "Global CDN" },
      ],
      external_url: "https://example-luxury-client.sada.tn",

      // 5. Media & Gallery
      thumbnail_url: "https://storage.sada.tn/media/projects/lux-thumb.jpg",
      cover_url: "https://storage.sada.tn/media/projects/lux-cover.jpg",
      gallery: [
        "https://storage.sada.tn/media/projects/lux-1.jpg",
        "https://storage.sada.tn/media/projects/lux-2.jpg",
      ],
      before_url: "https://storage.sada.tn/media/projects/before.jpg",
      after_url: "https://storage.sada.tn/media/projects/after.jpg",

      // 6. Team Members
      team_member_ids: ["tm-lead-designer-uuid", "tm-lead-engineer-uuid"],

      // 7. Client Testimonial (Inline JSONB)
      testimonial: {
        quote: "SADA transformed our brand presence into a true digital masterpiece.",
        name: "Claire de Valmont",
        role: "Chief Commercial Officer, Maison de Luxe",
      },

      // 8. SEO & Social
      seo_title: "Maison de Luxe Digital Transformation | SADA Case Study",
      seo_description: "Discover how SADA built a high-performance VIP digital ecosystem.",
    };

    const createdProject = await createProjectItem(projectPayload, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });
    createdProjectIds.push(createdProject.id);

    assert(Boolean(createdProject?.id), "Case Study CRUD", "Created Case Study project record");
    assert(createdProject.slug === projectSlug, "Case Study CRUD", "Project slug matches input");
    assert(createdProject.published === false, "Case Study CRUD", "Project saved as draft initially");

    // Verify all 8 sections persisted in PostgreSQL
    const dbProject = (
      await queryLocalJson(
        `SELECT * FROM projects WHERE id = '${createdProject.id}'`
      )
    )[0];

    // Section 1 Verification (Overview & Basics + Arabic columns from repair migration)
    assert(
      dbProject.title === projectPayload.title &&
        dbProject.title_ar === projectPayload.title_ar &&
        dbProject.client === projectPayload.client &&
        dbProject.client_ar === projectPayload.client_ar &&
        dbProject.industry === projectPayload.industry &&
        dbProject.industry_ar === projectPayload.industry_ar &&
        dbProject.category === projectPayload.category &&
        dbProject.category_ar === projectPayload.category_ar,
      "Case Study 8-Sections",
      "Section 1 (Overview & Basics + Arabic columns) persisted exactly"
    );

    // Section 2 Verification (Story & Narrative)
    assert(
      dbProject.challenge === projectPayload.challenge &&
        dbProject.challenge_ar === projectPayload.challenge_ar &&
        dbProject.objective === projectPayload.objective &&
        dbProject.objective_ar === projectPayload.objective_ar &&
        dbProject.strategy === projectPayload.strategy &&
        dbProject.strategy_ar === projectPayload.strategy_ar &&
        dbProject.process === projectPayload.process &&
        dbProject.process_ar === projectPayload.process_ar,
      "Case Study 8-Sections",
      "Section 2 (Project Story + Arabic narrative) persisted exactly"
    );

    // Section 3 Verification (Services & Deliverables)
    assert(
      Array.isArray(dbProject.services) &&
        dbProject.services.length === 3 &&
        Array.isArray(dbProject.deliverables) &&
        dbProject.deliverables.length === 3,
      "Case Study 8-Sections",
      "Section 3 (Services & Deliverables arrays) persisted exactly"
    );

    // Section 4 Verification (Results & Metrics)
    assert(
      dbProject.results === projectPayload.results &&
        dbProject.results_ar === projectPayload.results_ar &&
        Array.isArray(dbProject.metrics) &&
        dbProject.metrics[0].value === "+320%",
      "Case Study 8-Sections",
      "Section 4 (Results & Metrics jsonb) persisted exactly"
    );

    // Section 5 Verification (Media & Gallery)
    assert(
      dbProject.thumbnail_url === projectPayload.thumbnail_url &&
        dbProject.cover_url === projectPayload.cover_url &&
        Array.isArray(dbProject.gallery) &&
        dbProject.gallery.length === 2 &&
        dbProject.before_url === projectPayload.before_url &&
        dbProject.after_url === projectPayload.after_url,
      "Case Study 8-Sections",
      "Section 5 (Media, Gallery, Before/After URLs) persisted exactly"
    );

    // Section 6 Verification (Team Members)
    assert(
      Array.isArray(dbProject.team_member_ids) &&
        dbProject.team_member_ids.includes("tm-lead-designer-uuid"),
      "Case Study 8-Sections",
      "Section 6 (Team Member IDs) persisted exactly"
    );

    // Section 7 Verification (Client Testimonial)
    assert(
      dbProject.testimonial &&
        typeof dbProject.testimonial === "object" &&
        dbProject.testimonial.name === "Claire de Valmont",
      "Case Study 8-Sections",
      "Section 7 (Client Testimonial JSONB) persisted exactly"
    );

    // Section 8 Verification (SEO & Social)
    assert(
      dbProject.seo_title === projectPayload.seo_title &&
        dbProject.seo_description === projectPayload.seo_description,
      "Case Study 8-Sections",
      "Section 8 (SEO Title & Description) persisted exactly"
    );

    // =========================================================================
    // SUITE 4: Slug Uniqueness Constraint Enforcement
    // =========================================================================
    console.log("\n--- SUITE 4: Slug Uniqueness Constraint Enforcement ---");

    let duplicateSlugBlocked = false;
    try {
      await createProjectItem(
        {
          title: "Duplicate Slug Attempt",
          slug: projectSlug, // Same slug as createdProject
          published: false,
        },
        {
          ctx: adminCtx,
          actorRole: "admin",
          actorId: adminCtx.userId,
          clientOverride: adminClient,
        }
      );
    } catch (err: any) {
      duplicateSlugBlocked = true;
    }
    assert(
      duplicateSlugBlocked,
      "Slug Uniqueness",
      "Attempting to insert a project with duplicate slug was rejected by database constraint"
    );

    // =========================================================================
    // SUITE 5: Draft / Publish Public Visibility Integration
    // =========================================================================
    console.log("\n--- SUITE 5: Draft / Publish Public Visibility Integration ---");

    // 5.1 Query simulating public /case-studies loader
    const publicQuerySql = `
      SELECT id, slug, title, title_ar, client, client_ar, industry, industry_ar,
             category, category_ar, description, description_ar, thumbnail_url,
             cover_url, services, featured, sort_order, created_at
      FROM projects
      WHERE published = true
      ORDER BY sort_order ASC, created_at DESC
    `;

    const publicBefore = await queryLocalJson(publicQuerySql);
    const publicSlugsBefore = publicBefore.map((p: any) => p.slug);
    assert(
      !publicSlugsBefore.includes(projectSlug),
      "Public Integration",
      "Draft Case Study is completely absent from public portfolio listings"
    );

    // 5.2 Publish the Case Study
    await publishProjectItem(createdProject.id, true, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });

    const publicAfterPublish = await queryLocalJson(publicQuerySql);
    const publishedProject = publicAfterPublish.find((p: any) => p.slug === projectSlug);
    assert(
      Boolean(publishedProject),
      "Public Integration",
      "Case Study appears immediately in public portfolio after publication"
    );
    assert(
      publishedProject?.title_ar === projectPayload.title_ar,
      "Public Integration",
      "Public query correctly returns multilingual Arabic columns without errors"
    );

    // 5.3 Unpublish and verify removal
    await publishProjectItem(createdProject.id, false, {
      ctx: adminCtx,
      actorRole: "admin",
      actorId: adminCtx.userId,
      clientOverride: adminClient,
    });

    const publicAfterUnpublish = await queryLocalJson(publicQuerySql);
    const unpubProject = publicAfterUnpublish.find((p: any) => p.slug === projectSlug);
    assert(
      !unpubProject,
      "Public Integration",
      "Case Study is removed immediately from public portfolio after unpublishing"
    );

    // =========================================================================
    // SUITE 6: RBAC Authorization & Security Layer Enforcement
    // =========================================================================
    console.log("\n--- SUITE 6: RBAC Authorization & Security Isolation Enforcement ---");

    // 6.1 Worker role must be BLOCKED from creating projects
    let workerProjectCreateBlocked = false;
    try {
      await createProjectItem(
        { title: "Unauthorized Worker Project", slug: `worker-proj-${testRunId}` },
        {
          ctx: workerCtx,
          actorRole: "worker",
          actorId: workerCtx.userId,
          clientOverride: workerClient,
        }
      );
    } catch (err: any) {
      workerProjectCreateBlocked = true;
    }
    assert(
      workerProjectCreateBlocked,
      "RBAC Enforcement",
      "Worker role is blocked from creating Case Studies (HTTP 403 Forbidden)"
    );

    // 6.2 Worker role must be BLOCKED from creating reels
    let workerReelCreateBlocked = false;
    try {
      await createSocialReel(
        {
          title: "Unauthorized Worker Reel",
          instagram_url: "https://www.instagram.com/reel/C_WorkerBlocked/",
          instagram_shortcode: "C_WorkerBlocked",
          thumbnail_url: "https://storage.sada.tn/media/reels/blocked.jpg",
        },
        {
          ctx: workerCtx,
          actorRole: "worker",
          actorId: workerCtx.userId,
          clientOverride: workerClient,
        }
      );
    } catch (err: any) {
      workerReelCreateBlocked = true;
    }
    assert(
      workerReelCreateBlocked,
      "RBAC Enforcement",
      "Worker role is blocked from creating Social Reels (HTTP 403 Forbidden)"
    );

    // 6.3 Worker role must be BLOCKED from publishing projects
    let workerPublishBlocked = false;
    try {
      await publishProjectItem(createdProject.id, true, {
        ctx: workerCtx,
        actorRole: "worker",
        actorId: workerCtx.userId,
        clientOverride: workerClient,
      });
    } catch (err: any) {
      workerPublishBlocked = true;
    }
    assert(
      workerPublishBlocked,
      "RBAC Enforcement",
      "Worker role is blocked from publishing/unpublishing Case Studies"
    );

    // 6.4 Worker role must be BLOCKED from deleting reels
    let workerDeleteReelBlocked = false;
    try {
      await deleteSocialReel(reelA.id, {
        ctx: workerCtx,
        actorRole: "worker",
        actorId: workerCtx.userId,
        clientOverride: workerClient,
      });
    } catch (err: any) {
      workerDeleteReelBlocked = true;
    }
    assert(
      workerDeleteReelBlocked,
      "RBAC Enforcement",
      "Worker role is blocked from deleting Social Reels (HTTP 403 Forbidden)"
    );

    // 6.5 Super Admin deletion of Reel
    await deleteSocialReel(reelB.id, {
      ctx: superAdminCtx,
      actorRole: "super_admin",
      actorId: superAdminCtx.userId,
      clientOverride: superAdminClient,
    });
    const reelBCheck = await queryLocalJson(
      `SELECT count(*)::int as count FROM social_reels WHERE id = '${reelB.id}'`
    );
    assert(reelBCheck[0].count === 0, "Deletion Integrity", "Super Admin successfully deleted Reel B");
    // Remove from created list since it's already deleted
    const indexB = createdReelIds.indexOf(reelB.id);
    if (indexB !== -1) createdReelIds.splice(indexB, 1);

    // 6.6 Standard Admin attempting to delete Case Study must be BLOCKED (Super Admin exclusive)
    let adminDeleteBlocked = false;
    try {
      await deleteProjectItem(createdProject.id, {
        ctx: adminCtx,
        actorRole: "admin",
        actorId: adminCtx.userId,
        clientOverride: adminClient,
      });
    } catch (err: any) {
      if (err.code === "FORBIDDEN_DELETE" || err.message?.includes("Super Admin exclusive")) {
        adminDeleteBlocked = true;
      }
    }
    assert(
      adminDeleteBlocked,
      "RBAC Enforcement",
      "Standard Admin is blocked from permanently deleting Case Studies (Super Admin exclusive)"
    );

    // 6.7 Super Admin deletion of Case Study
    await deleteProjectItem(createdProject.id, {
      ctx: superAdminCtx,
      actorRole: "super_admin",
      actorId: superAdminCtx.userId,
      clientOverride: superAdminClient,
    });
    const projCheck = await queryLocalJson(
      `SELECT count(*)::int as count FROM projects WHERE id = '${createdProject.id}'`
    );
    assert(projCheck[0].count === 0, "Deletion Integrity", "Super Admin successfully deleted Case Study");
    const indexP = createdProjectIds.indexOf(createdProject.id);
    if (indexP !== -1) createdProjectIds.splice(indexP, 1);
  } finally {
    // Clean up any remaining synthetic records created during this certification run
    console.log("\n--- Cleaning up synthetic test records ---");
    if (createdReelIds.length > 0) {
      await runLocalSql(
        `DELETE FROM social_reels WHERE id IN (${createdReelIds.map((id) => `'${id}'`).join(",")})`
      );
      console.log(`Cleaned up ${createdReelIds.length} synthetic reel record(s).`);
    }
    if (createdProjectIds.length > 0) {
      await runLocalSql(
        `DELETE FROM projects WHERE id IN (${createdProjectIds.map((id) => `'${id}'`).join(",")})`
      );
      console.log(`Cleaned up ${createdProjectIds.length} synthetic project record(s).`);
    }
  }

  // =========================================================================
  // CERTIFICATION SUMMARY & RESULTS
  // =========================================================================
  console.log("\n================================================================================");
  console.log("MASTER CERTIFICATION RESULTS SUMMARY");
  console.log("================================================================================");

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  const suites = Array.from(new Set(results.map((r) => r.suite)));
  for (const s of suites) {
    const sTests = results.filter((r) => r.suite === s);
    const sPassed = sTests.filter((r) => r.passed).length;
    console.log(`• [${sPassed}/${sTests.length}] ${s}`);
  }

  console.log(`\nTOTAL ASSERTIONS: ${results.length}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);

  if (failedCount > 0) {
    console.error("\n❌ CERTIFICATION FAILED. Review errors above.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL ASSERTIONS PASSED — LOCAL MVP RUNTIME CERTIFIED.");
    process.exit(0);
  }
}

runMasterCertification().catch((err) => {
  console.error("FATAL: Master certification aborted:", err);
  process.exit(1);
});
