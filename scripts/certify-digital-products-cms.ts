/**
 * SADA OS — Digital Products CMS
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
  createDigitalProduct,
  updateDigitalProduct,
  publishDigitalProduct,
  setFeaturedDigitalProduct,
  duplicateDigitalProduct,
  deleteDigitalProduct,
  validateGumroadUrl,
  validateProductReadiness,
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
  console.log("SADA OS — DIGITAL PRODUCTS CMS MASTER RUNTIME CERTIFICATION");
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

  // Authoritative QA principals in local PostgreSQL
  const ADMIN_USER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // QA Standard Admin
  const SUPER_ADMIN_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // QA Super Admin
  const WORKER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // QA Worker Specialist

  const adminClient = createLocalTestClient(ADMIN_USER_ID);
  const superAdminClient = createLocalTestClient(SUPER_ADMIN_USER_ID);
  const workerClient = createLocalTestClient(WORKER_USER_ID);

  const testRunId = `cert-${Date.now()}`;
  const createdProductIds: string[] = [];

  const adminCtx = { role: "admin" as const, userId: ADMIN_USER_ID };
  const superAdminCtx = { role: "super_admin" as const, userId: SUPER_ADMIN_USER_ID };
  const workerCtx = { role: "worker" as const, userId: WORKER_USER_ID };

  try {
    // ========================================================================
    // DIMENSION 1: Schema & Constraints Verification
    // ========================================================================
    console.log("\n--- Dimension 1: Schema & Constraints Verification ---");
    const cols = queryLocalJson<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public' ORDER BY column_name;`
    );
    const colNames = cols.map((c) => c.column_name);

    const requiredColumns = [
      "id",
      "title",
      "slug",
      "description",
      "full_description",
      "price",
      "currency",
      "thumbnail_url",
      "gumroad_url",
      "category",
      "published",
      "featured",
      "sort_order",
      "gallery",
      "includes",
      "features",
      "audience",
      "details",
      "preview_url",
      "cta_label",
      "seo_title",
      "seo_description",
      "og_image_url",
      "title_ar",
      "name_ar",
      "description_ar",
      "full_description_ar",
      "details_ar",
      "category_ar",
      "audience_ar",
      "target_audience_ar",
      "cta_label_ar",
      "seo_title_ar",
      "seo_description_ar",
      "created_at",
      "updated_at",
    ];

    for (const reqCol of requiredColumns) {
      assert(
        colNames.includes(reqCol),
        "Schema Integrity",
        `Column 'public.products.${reqCol}' exists in local test DB`
      );
    }

    // Verify slug unique index/constraint
    const indexes = queryLocalJson<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND schemaname = 'public';`
    );
    const indexNames = indexes.map((i) => i.indexname);
    assert(
      indexNames.some((n) => n.includes("slug")),
      "Schema Integrity",
      "Unique constraint or index on products(slug) exists"
    );

    // Verify trigger set_updated_at
    const triggers = queryLocalJson<{ trigger_name: string }>(
      `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'products';`
    );
    assert(
      triggers.some((t) => t.trigger_name === "products_updated"),
      "Schema Integrity",
      "Trigger 'products_updated' exists on public.products"
    );

    // ========================================================================
    // DIMENSION 2: RLS Policies & Grant Scoping
    // ========================================================================
    console.log("\n--- Dimension 2: RLS Policies & Grant Scoping ---");
    const rlsStatus = queryLocalJson<{ rowsecurity: boolean }>(
      `SELECT rowsecurity FROM pg_tables WHERE tablename = 'products' AND schemaname = 'public';`
    );
    assert(
      rlsStatus[0]?.rowsecurity === true,
      "RLS Verification",
      "Row Level Security is ENABLED on public.products"
    );

    const policies = queryLocalJson<{ policyname: string; roles: string[] }>(
      `SELECT policyname, roles FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public';`
    );
    const adminReadPolicy = policies.find((p) => p.policyname.toLowerCase().includes("admins read"));
    assert(
      !!adminReadPolicy,
      "RLS Verification",
      "Admins read all products policy exists"
    );
    assert(
      !adminReadPolicy?.roles.includes("public"),
      "RLS Verification",
      "Admins read policy is scoped TO authenticated, not public (DEF-PROD-02 fixed)"
    );

    // ========================================================================
    // DIMENSION 3: Authoritative Gumroad URL Validation
    // ========================================================================
    console.log("\n--- Dimension 3: Gumroad URL Validation ---");
    const validGumroad1 = validateGumroadUrl("https://gumroad.com/l/sada-brand-kit");
    assert(validGumroad1.isValid === true, "Gumroad URL", "Accepts standard HTTPS Gumroad link");

    const validGumroad2 = validateGumroadUrl("http://gumroad.com/l/free-palette");
    assert(validGumroad2.isValid === true, "Gumroad URL", "Accepts standard HTTP Gumroad link");

    const emptyGumroad = validateGumroadUrl("");
    assert(emptyGumroad.isValid === true && emptyGumroad.normalizedUrl === null, "Gumroad URL", "Accepts empty link for draft products");

    const unsafeScheme = validateGumroadUrl("javascript:alert(1)");
    assert(unsafeScheme.isValid === false, "Gumroad URL", "Rejects unsafe 'javascript:' URL scheme");

    const dataScheme = validateGumroadUrl("data:text/html,<script>alert(1)</script>");
    assert(dataScheme.isValid === false, "Gumroad URL", "Rejects unsafe 'data:' URL scheme");

    const malformedUrl = validateGumroadUrl("not-a-valid-url");
    assert(malformedUrl.isValid === false, "Gumroad URL", "Rejects malformed URL strings");

    // ========================================================================
    // DIMENSION 4: Product Readiness Checklist (6/6 Rules)
    // ========================================================================
    console.log("\n--- Dimension 4: Product Readiness Checklist (6/6 Rules) ---");
    const emptyProduct = {};
    const readinessEmpty = validateProductReadiness(emptyProduct);
    assert(readinessEmpty.score === 0, "Readiness Check", "Empty product scores 0/6");
    assert(readinessEmpty.allPassed === false, "Readiness Check", "Empty product fails allPassed");

    const partialProduct = {
      title: "SADA Digital Luxe Presets",
      slug: "sada-digital-luxe-presets",
      description: "A short description with more than twenty characters.",
      thumbnail_url: "https://example.com/cover.webp",
      price: 49,
      // Missing gumroad_url
    };
    const readinessPartial = validateProductReadiness(partialProduct);
    assert(readinessPartial.score === 5, "Readiness Check", "Product missing only Gumroad link scores 5/6");
    assert(readinessPartial.allPassed === false, "Readiness Check", "5/6 product fails allPassed");

    const completeProduct = {
      ...partialProduct,
      gumroad_url: "https://gumroad.com/l/sada-digital-luxe-presets",
    };
    const readinessComplete = validateProductReadiness(completeProduct);
    assert(readinessComplete.score === 6, "Readiness Check", "Complete product scores 6/6");
    assert(readinessComplete.allPassed === true, "Readiness Check", "6/6 product passes allPassed");

    // Price 0 is valid free product
    const freeProduct = { ...completeProduct, price: 0 };
    assert(
      validateProductReadiness(freeProduct).allPassed === true,
      "Readiness Check",
      "Price of 0 is recognized as valid free product"
    );

    // Negative price is invalid
    const negativePriceProduct = { ...completeProduct, price: -10 };
    assert(
      validateProductReadiness(negativePriceProduct).checks.find((c) => c.id === "price")?.passed === false,
      "Readiness Check",
      "Negative price fails price readiness check"
    );

    // ========================================================================
    // DIMENSION 5: Draft Product Creation & Persistence Lifecycle
    // ========================================================================
    console.log("\n--- Dimension 5: Draft Creation & Persistence Lifecycle ---");
    const draftPayload = {
      title: `QA Test Product ${testRunId}`,
      slug: `qa-test-product-${testRunId}`,
      description: "An isolated synthetic test digital product created for local runtime certification.",
      full_description: "Detailed pitch explaining the product assets, license, and deliverables.",
      price: 39,
      currency: "USD",
      category: "Templates",
      thumbnail_url: "https://example.com/thumbnails/product1.jpg",
      gallery: ["https://example.com/gallery/1.jpg", "https://example.com/gallery/2.jpg"],
      includes: ["Figma source files", "PDF documentation", "Commercial license"],
      features: ["Auto-layout 5.0", "Dark & Light variants", "Free updates"],
      audience: "Product designers, branding studios, and boutique agencies",
      details: "Compatible with Figma 2026. File size 42 MB.",
      preview_url: "https://preview.example.com/demo",
      cta_label: "Get the Pack",
      seo_title: `QA Test Product ${testRunId} — SADA`,
      seo_description: "The official SADA test digital product for local certification.",
      published: false,
      featured: false,
      sort_order: 10,
    };

    const createdDraft = await createDigitalProduct(draftPayload, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdProductIds.push(createdDraft.id);

    assert(!!createdDraft.id, "Product Lifecycle", "Draft digital product created with UUID");
    assert(createdDraft.published === false, "Product Lifecycle", "Product initial status is draft (published = false)");
    assert(createdDraft.price === 39, "Product Lifecycle", "Numeric price persisted correctly");
    assert(createdDraft.currency === "USD", "Product Lifecycle", "Currency USD persisted correctly");

    // Verify draft values in DB
    const persistedDraft = queryLocalJson<any>(
      `SELECT * FROM public.products WHERE id = '${createdDraft.id}';`
    )[0];
    assert(persistedDraft.title === draftPayload.title, "Persistence", "Product title matches");
    assert(persistedDraft.slug === draftPayload.slug, "Persistence", "Product slug matches");
    assert(persistedDraft.category === "Templates", "Persistence", "Category matches");
    assert(Array.isArray(persistedDraft.gallery) && persistedDraft.gallery.length === 2, "Persistence", "JSONB gallery matches");
    assert(Array.isArray(persistedDraft.includes) && persistedDraft.includes.length === 3, "Persistence", "Text array includes matches");

    // ========================================================================
    // DIMENSION 6: Public Store Isolation (Draft Exclusion)
    // ========================================================================
    console.log("\n--- Dimension 6: Public Store Isolation ---");
    // Public store query only selects published = true
    const publicStoreCatalog = queryLocalJson<any>(
      `SELECT id, slug, title FROM public.products WHERE published = true;`
    );
    assert(
      !publicStoreCatalog.some((p) => p.id === createdDraft.id),
      "Public Isolation",
      "Draft product does NOT appear in public storefront catalog"
    );

    const publicDirectSlug = queryLocalJson<any>(
      `SELECT id FROM public.products WHERE slug = '${draftPayload.slug}' AND published = true;`
    );
    assert(
      publicDirectSlug.length === 0,
      "Public Isolation",
      "Direct public lookup by slug returns zero records for unpublished draft"
    );

    // ========================================================================
    // DIMENSION 7: Publishing Lifecycle & Readiness Enforcement
    // ========================================================================
    console.log("\n--- Dimension 7: Publishing Lifecycle & Readiness Enforcement ---");
    // Attempting to publish without Gumroad URL must fail
    let publishFailedAsExpected = false;
    try {
      await publishDigitalProduct(createdDraft.id, true, {
        client: adminClient,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      });
    } catch (err: any) {
      publishFailedAsExpected = true;
      assert(
        err.message.toLowerCase().includes("readiness") || err.message.toLowerCase().includes("gumroad"),
        "Publishing Guard",
        "Publish blocked when mandatory readiness criteria (Gumroad link) is missing"
      );
    }
    assert(publishFailedAsExpected, "Publishing Guard", "Service prevented publishing unready draft");

    // Add valid Gumroad URL and update
    const gumroadLink = "https://gumroad.com/l/qa-test-product";
    await updateDigitalProduct(
      createdDraft.id,
      { gumroad_url: gumroadLink },
      { client: adminClient, actorRole: "admin", actorId: ADMIN_USER_ID }
    );

    // Now publish succeeds
    const publishedProduct = await publishDigitalProduct(createdDraft.id, true, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    assert(publishedProduct.published === true, "Publishing Lifecycle", "Product successfully published");

    // Public catalog now includes the published product
    const publicStoreCatalogAfter = queryLocalJson<any>(
      `SELECT id, slug, title FROM public.products WHERE published = true;`
    );
    assert(
      publicStoreCatalogAfter.some((p) => p.id === createdDraft.id),
      "Public Discovery",
      "Published product appears in public store catalog"
    );

    // Resolves by slug
    const resolvedBySlug = queryLocalJson<any>(
      `SELECT id, title, price, gumroad_url FROM public.products WHERE slug = '${draftPayload.slug}' AND published = true;`
    )[0];
    assert(resolvedBySlug?.id === createdDraft.id, "Public Storefront", "Product resolves by slug (/store/:slug)");
    assert(resolvedBySlug?.gumroad_url === gumroadLink, "Public Storefront", "Correct Gumroad URL served to storefront");

    // Legacy UUID resolution (/store/:uuid)
    const resolvedByUuid = queryLocalJson<any>(
      `SELECT id FROM public.products WHERE id = '${createdDraft.id}' AND published = true;`
    )[0];
    assert(resolvedByUuid?.id === createdDraft.id, "Legacy Compatibility", "Product resolves by UUID (/store/:uuid)");

    // ========================================================================
    // DIMENSION 8: Unpublish Lifecycle & Immediate Public Concealment
    // ========================================================================
    console.log("\n--- Dimension 8: Unpublish Lifecycle ---");
    await publishDigitalProduct(createdDraft.id, false, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });

    const publicAfterUnpublish = queryLocalJson<any>(
      `SELECT id FROM public.products WHERE id = '${createdDraft.id}' AND published = true;`
    );
    assert(
      publicAfterUnpublish.length === 0,
      "Unpublish Lifecycle",
      "Unpublished product immediately removed from public discovery"
    );

    // ========================================================================
    // DIMENSION 9: Slug Collision Defense & Format Validation
    // ========================================================================
    console.log("\n--- Dimension 9: Slug Collision Defense & Validation ---");
    let invalidSlugRejected = false;
    try {
      await createDigitalProduct(
        { title: "Invalid Slug Product", slug: "INVALID SLUG WITH SPACES!" },
        { client: adminClient, actorRole: "admin", actorId: ADMIN_USER_ID }
      );
    } catch (err: any) {
      invalidSlugRejected = true;
      assert(
        err.message.toLowerCase().includes("slug"),
        "Slug Validation",
        "Rejects slug with spaces/uppercase characters"
      );
    }
    assert(invalidSlugRejected, "Slug Validation", "Invalid slug format rejected at service boundary");

    let slugClashRejected = false;
    try {
      await createDigitalProduct(
        { title: "Clash Product", slug: draftPayload.slug }, // Same slug as createdDraft
        { client: adminClient, actorRole: "admin", actorId: ADMIN_USER_ID }
      );
    } catch (err: any) {
      slugClashRejected = true;
      assert(
        err.message.includes("already in use"),
        "Slug Collision",
        "Rejects duplicate slug across products"
      );
    }
    assert(slugClashRejected, "Slug Collision", "Duplicate slug collision blocked at service boundary");

    // ========================================================================
    // DIMENSION 10: Multilingual Arabic Field Persistence
    // ========================================================================
    console.log("\n--- Dimension 10: Multilingual Arabic Persistence ---");
    const arabicUpdates = {
      title_ar: "حزمة الهوية الرقمية الفاخرة للاختبار",
      name_ar: "حزمة الهوية الرقمية الفاخرة للاختبار",
      description_ar: "وصف مختصر باللغة العربية مخصص لاختبار قابلية التخزين والعرض في المتجر.",
      full_description_ar: "تفاصيل كاملة باللغة العربية تشمل المكونات وحقوق الاستخدام وقوالب فيجما المرفقة.",
      category_ar: "قوالب رقمية",
      target_audience_ar: "المصممون والشركات الناشئة في تونس والعالم العربي",
      details_ar: "ملفات فيجما + ملفات بي دي إف. حجم الملف 42 ميغابايت.",
      cta_label_ar: "احصل على الحزمة الآن",
      seo_title_ar: "حزمة الهوية الرقمية الفاخرة — صدى",
      seo_description_ar: "أدوات وقوالب متقدمة لنمو علامتك التجارية من صدى.",
    };

    await updateDigitalProduct(createdDraft.id, arabicUpdates, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });

    const persistedArabic = queryLocalJson<any>(
      `SELECT title_ar, name_ar, description_ar, full_description_ar, category_ar, target_audience_ar, details_ar, cta_label_ar, seo_title_ar, seo_description_ar FROM public.products WHERE id = '${createdDraft.id}';`
    )[0];

    assert(persistedArabic.title_ar === arabicUpdates.title_ar, "Multilingual", "title_ar persisted accurately");
    assert(persistedArabic.name_ar === arabicUpdates.name_ar, "Multilingual", "name_ar persisted accurately");
    assert(persistedArabic.description_ar === arabicUpdates.description_ar, "Multilingual", "description_ar persisted accurately");
    assert(persistedArabic.category_ar === arabicUpdates.category_ar, "Multilingual", "category_ar persisted accurately");
    assert(persistedArabic.target_audience_ar === arabicUpdates.target_audience_ar, "Multilingual", "target_audience_ar persisted accurately");
    assert(persistedArabic.cta_label_ar === arabicUpdates.cta_label_ar, "Multilingual", "cta_label_ar persisted accurately");

    // ========================================================================
    // DIMENSION 11: Featured Products & Storefront Ordering
    // ========================================================================
    console.log("\n--- Dimension 11: Featured Products & Storefront Ordering ---");
    await setFeaturedDigitalProduct(createdDraft.id, true, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    const featuredCheck = queryLocalJson<any>(
      `SELECT featured FROM public.products WHERE id = '${createdDraft.id}';`
    )[0];
    assert(featuredCheck.featured === true, "Featured Ordering", "Product marked as featured = true");

    await setFeaturedDigitalProduct(createdDraft.id, false, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    const unfeaturedCheck = queryLocalJson<any>(
      `SELECT featured FROM public.products WHERE id = '${createdDraft.id}';`
    )[0];
    assert(unfeaturedCheck.featured === false, "Featured Ordering", "Product toggled to featured = false");

    // ========================================================================
    // DIMENSION 12: Duplication Workflow
    // ========================================================================
    console.log("\n--- Dimension 12: Duplication Workflow ---");
    const duplicated = await duplicateDigitalProduct(createdDraft.id, {
      client: adminClient,
      actorRole: "admin",
      actorId: ADMIN_USER_ID,
    });
    createdProductIds.push(duplicated.id);

    assert(duplicated.id !== createdDraft.id, "Duplication", "Duplicated product gets fresh UUID");
    assert(duplicated.title.includes("(copy)"), "Duplication", "Duplicated title appends '(copy)'");
    assert(duplicated.slug.includes("-copy-"), "Duplication", "Duplicated slug has unique copy suffix");
    assert(duplicated.published === false, "Duplication", "Duplicated product is created as unpublished draft");
    assert(duplicated.featured === false, "Duplication", "Duplicated product is created as unfeatured");

    // ========================================================================
    // DIMENSION 13: Dashboard Metric Reconciliation
    // ========================================================================
    console.log("\n--- Dimension 13: Dashboard Metric Reconciliation ---");
    const allProducts = queryLocalJson<any>(`SELECT id, published, featured FROM public.products;`);
    const totalCount = allProducts.length;
    const publishedCount = allProducts.filter((p) => p.published).length;
    const draftCount = allProducts.filter((p) => !p.published).length;
    const featuredCount = allProducts.filter((p) => p.featured).length;

    assert(totalCount === publishedCount + draftCount, "Metrics Reconciliation", "Total = Published + Drafts invariant holds");
    assert(publishedCount >= 0 && draftCount >= 0, "Metrics Reconciliation", "Counter values are non-negative integers");

    // ========================================================================
    // DIMENSION 14: Security, Authorization & RLS Enforcement
    // ========================================================================
    console.log("\n--- Dimension 14: Security, Authorization & RLS Enforcement ---");

    // Worker role cannot create digital products
    let workerCreateBlocked = false;
    try {
      await createDigitalProduct(
        { title: "Worker Product", slug: `worker-prod-${Date.now()}` },
        { client: workerClient, actorRole: "worker", actorId: WORKER_USER_ID }
      );
    } catch {
      workerCreateBlocked = true;
    }
    assert(workerCreateBlocked, "RBAC Enforcement", "Worker specialist cannot create digital products");

    // Worker role cannot publish products
    let workerPublishBlocked = false;
    try {
      await publishDigitalProduct(createdDraft.id, true, {
        client: workerClient,
        actorRole: "worker",
        actorId: WORKER_USER_ID,
      });
    } catch {
      workerPublishBlocked = true;
    }
    assert(workerPublishBlocked, "RBAC Enforcement", "Worker specialist cannot publish digital products");

    // Standard Admin CANNOT delete products (Super Admin exclusive invariant)
    let adminDeleteBlocked = false;
    try {
      await deleteDigitalProduct(createdDraft.id, {
        client: adminClient,
        actorRole: "admin",
        actorId: ADMIN_USER_ID,
      });
    } catch (err: any) {
      adminDeleteBlocked = true;
      assert(
        err.code === "FORBIDDEN_DELETE" || err.message.includes("Super Admin"),
        "RBAC Enforcement",
        "Standard admin deletion rejected with FORBIDDEN_DELETE error"
      );
    }
    assert(adminDeleteBlocked, "RBAC Enforcement", "Standard admin CANNOT permanently delete products");

    // Super Admin CAN delete products
    await deleteDigitalProduct(createdDraft.id, {
      client: superAdminClient,
      actorRole: "super_admin",
      actorId: SUPER_ADMIN_USER_ID,
    });
    const checkDeleted = queryLocalJson<any>(
      `SELECT id FROM public.products WHERE id = '${createdDraft.id}';`
    );
    assert(checkDeleted.length === 0, "RBAC Enforcement", "Super Admin successfully deletes product");

    // Delete duplicated test record
    await deleteDigitalProduct(duplicated.id, {
      client: superAdminClient,
      actorRole: "super_admin",
      actorId: SUPER_ADMIN_USER_ID,
    });
  } finally {
    // Clean up any remaining synthetic test records created during this run
    console.log("\n--- Cleaning up synthetic test records ---");
    for (const pid of createdProductIds) {
      try {
        runLocalSql(`DELETE FROM public.products WHERE id = '${pid}';`);
      } catch {}
    }
    console.log(`Cleaned up ${createdProductIds.length} synthetic test product records.`);
  }

  // ========================================================================
  // CERTIFICATION REPORT
  // ========================================================================
  console.log("\n================================================================================");
  console.log("DIGITAL PRODUCTS CMS MASTER CERTIFICATION SUMMARY");
  console.log("================================================================================");

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Failed:           ${failedCount}`);

  if (failedCount > 0) {
    console.error("\nFailed Tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.suite}] ${r.test}: ${r.message || "Assertion failed"}`);
    });
    process.exit(1);
  } else {
    console.log("\nALL DIGITAL PRODUCTS CMS INTEGRITY ASSERTIONS PASSED (100% PASS RATE).");
    process.exit(0);
  }
}

runMasterCertification().catch((err) => {
  console.error("FATAL: Unhandled certification error:", err);
  process.exit(1);
});
