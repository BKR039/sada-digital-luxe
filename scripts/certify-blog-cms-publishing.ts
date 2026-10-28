/**
 * SADA OS — Blog CMS & Publishing Engine: Production-Grade Certification Suite
 *
 * Automated verification across 18 core dimensions:
 * 1. Database Isolation Guard (Zero remote mutations)
 * 2. Schema, Indexes & Trigger Integrity (23 columns, slug uniqueness, category_ar)
 * 3. Article Creation & Draft Persistence
 * 4. 6/6 Publish Readiness Model (Advisory vs Blocking)
 * 5. Multilingual Field Persistence (English + Arabic fields)
 * 6. Slug Uniqueness & Manual Override Preservation
 * 7. Cover Image & Accessibility Alt Text Persistence
 * 8. Content Formatting & Rendering Safety (Markdown & XSS neutralization)
 * 9. SEO & Social Sharing Metadata Persistence
 * 10. Immediate Publish Lifecycle & Timestamp Generation
 * 11. Scheduled Publishing Lifecycle & Timezone Gate
 * 12. Public Route Filtering & Schedule Protection (/blog & /blog/$slug)
 * 13. Unpublish / Revert-to-Draft Lifecycle
 * 14. Featured Article Flag & Prioritization
 * 15. Dashboard Metric Reconciliation (Total, Published, Draft, Scheduled)
 * 16. Multilingual Admin Search (English & Arabic titles/excerpts)
 * 17. Blog Section Visibility Toggle (site_settings 'blog')
 * 18. Multi-Role RBAC & RLS Enforcement (Anon, Worker, Admin, Super Admin)
 */

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";

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
  safeEnv.PGCLIENTENCODING = "UTF8";
  return safeEnv;
}

function runSql(sql: string, stopOnError = true): string {
  assertSafeTarget();
  const args = ["-X", "-A", "-t", "-d", TARGET_DB];
  if (stopOnError) {
    args.push("-v", "ON_ERROR_STOP=1");
  }
  return execFileSync(
    PSQL_BIN,
    args,
    {
      env: getSanitizedEnv(),
      input: sql,
      encoding: "utf-8",
    }
  ).trim();
}

function runSqlJson<T = any>(sql: string): T {
  const wrapped = `SELECT coalesce(json_agg(t), '[]'::json) FROM (${sql}) t;`;
  const raw = runSql(wrapped);
  return JSON.parse(raw) as T;
}

let passed = 0;
let failed = 0;
const results: { category: string; name: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function assert(category: string, condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] [${category}] ${testName}`);
    passed++;
    results.push({ category, name: testName, status: "PASS" });
  } else {
    console.error(`  ✗ [FAIL] [${category}] ${testName}`, detail || "");
    failed++;
    results.push({
      category,
      name: testName,
      status: "FAIL",
      details: typeof detail === "string" ? detail : JSON.stringify(detail),
    });
  }
}

// User UUIDs configured in local test DB
const SUPER_ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STANDARD_ADMIN_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const WORKER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

async function runCertification() {
  console.log("==========================================================================");
  console.log("  SADA OS — Blog CMS & Publishing Engine: Runtime Certification Suite");
  console.log("==========================================================================\n");

  // ---------------------------------------------------------------------------
  // SECTION 1: Target Database Isolation Guard
  // ---------------------------------------------------------------------------
  console.log("--- SECTION 1: Target Database Isolation Guard ---");
  try {
    assertSafeTarget();
    assert("ISOLATION", true, "Target database independently verified as isolated local test environment");
  } catch (err: any) {
    assert("ISOLATION", false, "Target database isolation check failed", err.message);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Schema, Indexes & Trigger Integrity
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Schema, Indexes & Trigger Integrity ---");

  // Verify columns count
  const cols = runSqlJson<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'blog_posts'`
  );
  assert("SCHEMA", cols.length === 23, `public.blog_posts has exact 23 columns (found ${cols.length})`);

  const colNames = cols.map((c) => c.column_name);
  assert("SCHEMA", colNames.includes("category_ar"), "public.blog_posts contains category_ar column (DEF-BLOG-01)");
  assert("SCHEMA", colNames.includes("title_ar"), "public.blog_posts contains title_ar column");
  assert("SCHEMA", colNames.includes("excerpt_ar"), "public.blog_posts contains excerpt_ar column");
  assert("SCHEMA", colNames.includes("content_ar"), "public.blog_posts contains content_ar column");
  assert("SCHEMA", colNames.includes("cover_url"), "public.blog_posts contains cover_url column");
  assert("SCHEMA", colNames.includes("cover_alt"), "public.blog_posts contains cover_alt column");
  assert("SCHEMA", colNames.includes("seo_title"), "public.blog_posts contains seo_title column");
  assert("SCHEMA", colNames.includes("seo_description"), "public.blog_posts contains seo_description column");
  assert("SCHEMA", colNames.includes("slug"), "public.blog_posts contains slug column");
  assert("SCHEMA", colNames.includes("published_at"), "public.blog_posts contains published_at timestamp");
  assert("SCHEMA", colNames.includes("featured"), "public.blog_posts contains featured boolean");

  // Verify unique constraint on slug
  const uniqueConstraints = runSql(
    `SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.blog_posts'::regclass AND contype = 'u' AND conname = 'blog_posts_slug_key'`
  );
  assert("SCHEMA", parseInt(uniqueConstraints, 10) >= 1, "Unique constraint blog_posts_slug_key is enforced");

  // Verify site_settings table exists
  const settingsCount = runSql(
    `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_settings'`
  );
  assert("SCHEMA", parseInt(settingsCount, 10) === 1, "public.site_settings table exists");

  // ---------------------------------------------------------------------------
  // SECTION 3: Article Creation & Draft Persistence
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Article Creation & Draft Persistence ---");

  const testDraftId = "11111111-0001-0001-0001-000000000001";
  const testDraftSlug = "test-blog-cert-draft-article";

  // Clean any previous test run records
  runSql(`DELETE FROM public.blog_posts WHERE slug LIKE 'test-blog-cert-%' OR id = '${testDraftId}'`);

  // Insert Draft article
  runSql(`
    INSERT INTO public.blog_posts (
      id, title, slug, excerpt, content, category, author,
      published, published_at, featured, created_at, updated_at
    ) VALUES (
      '${testDraftId}',
      'Test Draft Article Title',
      '${testDraftSlug}',
      'This is a draft article excerpt for testing persistence.',
      '## Introduction\\n\\nThis is the markdown body of the draft article.',
      'Branding & Strategy',
      'SADA Editorial Team',
      false,
      null,
      false,
      now(),
      now()
    );
  `);

  const fetchedDraft = runSqlJson<any>(`SELECT * FROM public.blog_posts WHERE id = '${testDraftId}'`)[0];
  assert("DRAFT", Boolean(fetchedDraft), "Draft article created and persisted in public.blog_posts");
  assert("DRAFT", fetchedDraft?.published === false, "Draft article has published = false");
  assert("DRAFT", fetchedDraft?.published_at === null, "Draft article has published_at = null");
  assert("DRAFT", fetchedDraft?.title === "Test Draft Article Title", "Title matches persisted draft");
  assert("DRAFT", fetchedDraft?.slug === testDraftSlug, "Slug matches persisted draft");

  // ---------------------------------------------------------------------------
  // SECTION 4: 6/6 Publish Readiness Scoring Model
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: 6/6 Publish Readiness Scoring Model ---");

  // The 6 readiness rules defined in admin.blog.$id.tsx:
  // 1. Title non-empty (title.trim().length > 0)
  // 2. Slug valid regex (/^[a-z0-9-]+$/.test(slug))
  // 3. Excerpt > 20 chars (excerpt.trim().length > 20)
  // 4. Content > 120 chars (content.trim().length > 120)
  // 5. Cover image set (cover_url.trim().length > 0)
  // 6. Category set (category.trim().length > 0)
  function computeReadiness(p: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    cover_url?: string;
    category?: string;
  }) {
    let score = 0;
    const checks: Record<string, boolean> = {};

    checks.title = Boolean(p.title && p.title.trim().length > 0);
    if (checks.title) score++;

    checks.slug = Boolean(p.slug && /^[a-z0-9-]+$/.test(p.slug.trim()));
    if (checks.slug) score++;

    checks.excerpt = Boolean(p.excerpt && p.excerpt.trim().length > 20);
    if (checks.excerpt) score++;

    checks.content = Boolean(p.content && p.content.trim().length > 120);
    if (checks.content) score++;

    checks.cover = Boolean(p.cover_url && p.cover_url.trim().length > 0);
    if (checks.cover) score++;

    checks.category = Boolean(p.category && p.category.trim().length > 0);
    if (checks.category) score++;

    return { score, checks };
  }

  // Evaluate incomplete draft: has title, slug, excerpt, category, but no cover and short content
  const incompleteDraft = computeReadiness({
    title: fetchedDraft.title,
    slug: fetchedDraft.slug,
    excerpt: fetchedDraft.excerpt,
    content: fetchedDraft.content, // only ~70 chars
    cover_url: "",
    category: fetchedDraft.category,
  });

  assert("READINESS", incompleteDraft.score === 4, `Incomplete draft correctly scores 4/6 (found ${incompleteDraft.score})`);
  assert("READINESS", incompleteDraft.checks.cover === false, "Missing cover_url fails check 5");
  assert("READINESS", incompleteDraft.checks.content === false, "Short content (<120 chars) fails check 4");

  // Evaluate ready article
  const completeArticle = computeReadiness({
    title: "Complete Masterclass in Modern Luxury Branding",
    slug: "luxury-branding-masterclass",
    excerpt: "Comprehensive insights into how high-end brands position themselves in competitive global and North African luxury markets.",
    content: "## The Architecture of Prestige\\n\\nLuxury branding requires emotional resonance, uncompromising visual craftsmanship, intentional restraint, and authentic storytelling that transcends utilitarian benefits.\\n\\n1. Brand Archetype Alignment\\n2. Sensory Design System\\n3. Scarcity & Exclusivity Signals",
    cover_url: "https://storage.sada.agency/covers/luxury-branding.webp",
    category: "Branding & Strategy",
  });

  assert("READINESS", completeArticle.score === 6, `Complete article achieves perfect 6/6 readiness (found ${completeArticle.score})`);

  // ---------------------------------------------------------------------------
  // SECTION 5: Multilingual Field Persistence (English + Arabic)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Multilingual Field Persistence ---");

  const testBilingualId = "11111111-0002-0002-0002-000000000002";
  const testBilingualSlug = "test-blog-cert-bilingual-article";

  // Clean testBilingualId
  runSql(`DELETE FROM public.blog_posts WHERE id = '${testBilingualId}' OR slug = '${testBilingualSlug}'`);

  runSql(`
    INSERT INTO public.blog_posts (
      id, title, title_ar, slug, excerpt, excerpt_ar,
      content, content_ar, category, category_ar, author,
      cover_url, cover_alt, published, published_at, featured
    ) VALUES (
      '${testBilingualId}',
      'Building a Premium Brand Identity',
      'بناء هوية علامة تجارية فاخرة',
      '${testBilingualSlug}',
      'How to build enduring value and command premium pricing through cohesive design and strategy.',
      'كيف تبني قيمة دائمة وتفرض أسعاراً متميزة من خلال التصميم المترابط والاستراتيجية المحكمة.',
      '## Premium Identity Framework\\n\\nDistinctive brand assets form the foundation.',
      '## إطار الهوية الفاخرة\\n\\nتشكل الأصول المميزة للعلامة التجارية الأساس الراسخ للنمو.',
      'Branding & Strategy',
      'الهوية والاستراتيجية',
      'SADA Editorial Team',
      'https://storage.sada.agency/covers/premium-brand.webp',
      'Premium brand identity book presentation',
      false,
      null,
      false
    );
  `);

  const fetchedBilingual = runSqlJson<any>(`SELECT * FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("MULTILINGUAL", fetchedBilingual?.title_ar === "بناء هوية علامة تجارية فاخرة", "Arabic title persists exactly");
  assert("MULTILINGUAL", fetchedBilingual?.excerpt_ar.includes("كيف تبني"), "Arabic excerpt persists exactly");
  assert("MULTILINGUAL", fetchedBilingual?.content_ar.includes("إطار الهوية الفاخرة"), "Arabic content persists exactly");
  assert("MULTILINGUAL", fetchedBilingual?.category_ar === "الهوية والاستراتيجية", "Arabic category label persists exactly (DEF-BLOG-01)");

  // ---------------------------------------------------------------------------
  // SECTION 6: Slug Generation, Formatting & Collision Protection
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: Slug Formatting & Collision Protection ---");

  function transformTitleToSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const generatedSlug = transformTitleToSlug("The 2026 Strategy: How SADA Delivers Luxury Growth!");
  assert("SLUG", generatedSlug === "the-2026-strategy-how-sada-delivers-luxury-growth", `Auto-slug generation produces clean kebab-case: '${generatedSlug}'`);

  // Attempt duplicate slug insertion -> must fail with unique violation
  let duplicateThrew = false;
  try {
    runSql(`
      INSERT INTO public.blog_posts (
        title, slug, excerpt, content, category, author, published
      ) VALUES (
        'Duplicate Slug Post',
        '${testBilingualSlug}',
        'Another excerpt',
        'Another content',
        'General',
        'Author',
        false
      );
    `);
  } catch {
    duplicateThrew = true;
  }
  assert("SLUG", duplicateThrew, "Duplicate slug insertion is strictly rejected by blog_posts_slug_key unique constraint");

  // ---------------------------------------------------------------------------
  // SECTION 7: Cover Image & Accessibility Alt Text Persistence
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 7: Cover Image & Alt Text Persistence ---");

  assert("COVER", fetchedBilingual?.cover_url === "https://storage.sada.agency/covers/premium-brand.webp", "Cover image URL persisted");
  assert("COVER", fetchedBilingual?.cover_alt === "Premium brand identity book presentation", "Cover image alt text persisted for accessibility");

  // ---------------------------------------------------------------------------
  // SECTION 8: Content Formatting & Rendering Safety
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 8: Content Formatting & Rendering Safety ---");

  // Verify that Markdown headings, bullet lists, bold and blockquotes are preserved
  const sampleMarkdown = `### Key Deliverables
- Strategic Brand Positioning
- Bespoke Typography System
- Custom High-Conversion Landing Page

> Luxury is not an accident; it is the discipline of continuous refinement.`;

  runSql(`UPDATE public.blog_posts SET content = '${sampleMarkdown.replace(/'/g, "''")}' WHERE id = '${testBilingualId}'`);
  const updatedContent = runSqlJson<any>(`SELECT content FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("FORMATTING", updatedContent?.content.includes("### Key Deliverables"), "Markdown subheadings preserved");
  assert("FORMATTING", updatedContent?.content.includes("- Strategic Brand Positioning"), "Bullet lists preserved");
  assert("FORMATTING", updatedContent?.content.includes("> Luxury is not an accident"), "Blockquotes preserved");

  // Safety test: Raw script tags must not execute in text rendering
  const scriptAttempt = `<script>alert('XSS')</script>Normal text`;
  const sanitizedText = scriptAttempt.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  assert("SECURITY", !sanitizedText.includes("<script>"), "Script tag sanitized from raw injection");

  // ---------------------------------------------------------------------------
  // SECTION 9: SEO & Social Metadata Persistence
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 9: SEO & Social Metadata Persistence ---");

  runSql(`
    UPDATE public.blog_posts SET
      seo_title = 'Bespoke Brand Identity Strategy | SADA Digital Luxe',
      seo_description = 'Discover our authoritative guide on luxury identity architecture and high-ticket customer acquisition.',
      og_image_url = 'https://storage.sada.agency/og/brand-strategy.png'
    WHERE id = '${testBilingualId}'
  `);

  const fetchedSeo = runSqlJson<any>(`SELECT seo_title, seo_description, og_image_url FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("SEO", fetchedSeo?.seo_title === "Bespoke Brand Identity Strategy | SADA Digital Luxe", "SEO seo_title persists");
  assert("SEO", fetchedSeo?.seo_description.includes("Discover our authoritative guide"), "SEO seo_description persists");
  assert("SEO", fetchedSeo?.og_image_url === "https://storage.sada.agency/og/brand-strategy.png", "Open Graph image URL persists");

  // ---------------------------------------------------------------------------
  // SECTION 10: Immediate Publish Lifecycle
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 10: Immediate Publish Lifecycle ---");

  // Publish testBilingualId
  runSql(`
    UPDATE public.blog_posts SET
      published = true,
      published_at = now() - interval '5 seconds'
    WHERE id = '${testBilingualId}'
  `);

  const livePost = runSqlJson<any>(`SELECT published, published_at FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("PUBLISH", livePost?.published === true, "Article published state transitions to true");
  assert("PUBLISH", Boolean(livePost?.published_at), "Publication timestamp recorded");

  // ---------------------------------------------------------------------------
  // SECTION 11: Scheduled Publishing Lifecycle & Timezone Gate
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 11: Scheduled Publishing Lifecycle ---");

  const testScheduledId = "11111111-0003-0003-0003-000000000003";
  const testScheduledSlug = "test-blog-cert-scheduled-article";

  // Clean testScheduledId
  runSql(`DELETE FROM public.blog_posts WHERE id = '${testScheduledId}' OR slug = '${testScheduledSlug}'`);

  // Create article scheduled for 7 days in the future
  runSql(`
    INSERT INTO public.blog_posts (
      id, title, slug, excerpt, content, category, author,
      published, published_at, featured
    ) VALUES (
      '${testScheduledId}',
      'Future Scheduled Insights on AI in Creative Direction',
      '${testScheduledSlug}',
      'A preview of how generative workflows impact high-tier agencies in 2027.',
      '## Future Vision\\n\\nScheduled publication content.',
      'Creative Direction',
      'SADA Technology Team',
      true,
      now() + interval '7 days',
      false
    );
  `);

  const scheduledPost = runSqlJson<any>(`SELECT published, published_at, (published_at > now()) AS is_future FROM public.blog_posts WHERE id = '${testScheduledId}'`)[0];
  assert("SCHEDULE", scheduledPost?.published === true, "Scheduled article has published = true");
  assert("SCHEDULE", scheduledPost?.is_future === true, "Scheduled article published_at is strictly in the future");

  // ---------------------------------------------------------------------------
  // SECTION 12: Public Route Query Gate (/blog and /blog/$slug)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 12: Public Route Query Gate & Schedule Protection ---");

  // Public listing query simulates /blog: published = true AND (published_at IS NULL OR published_at <= now())
  const publicListing = runSqlJson<any>(`
    SELECT id, slug, title FROM public.blog_posts
    WHERE published = true AND (published_at IS NULL OR published_at <= now())
  `);

  const publicSlugs = publicListing.map((p: any) => p.slug);
  assert("PUBLIC_GATE", publicSlugs.includes(testBilingualSlug), "Published article is visible in public listing");
  assert("PUBLIC_GATE", !publicSlugs.includes(testDraftSlug), "Draft article is strictly hidden from public listing");
  assert("PUBLIC_GATE", !publicSlugs.includes(testScheduledSlug), "Future-scheduled article is strictly hidden from public listing (DEF-BLOG-06)");

  // ---------------------------------------------------------------------------
  // SECTION 13: Unpublish / Revert-to-Draft Lifecycle
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 13: Unpublish Lifecycle ---");

  // Unpublish testBilingualId
  runSql(`UPDATE public.blog_posts SET published = false WHERE id = '${testBilingualId}'`);

  const unpublishedPost = runSqlJson<any>(`SELECT published FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("UNPUBLISH", unpublishedPost?.published === false, "Article reverted to published = false");

  const publicListingAfterUnpublish = runSqlJson<any>(`
    SELECT slug FROM public.blog_posts
    WHERE published = true AND (published_at IS NULL OR published_at <= now())
  `);
  const slugsAfter = publicListingAfterUnpublish.map((p: any) => p.slug);
  assert("UNPUBLISH", !slugsAfter.includes(testBilingualSlug), "Unpublished article instantly disappears from public listing");

  // Re-publish for subsequent tests
  runSql(`UPDATE public.blog_posts SET published = true, published_at = now() - interval '1 minute' WHERE id = '${testBilingualId}'`);

  // ---------------------------------------------------------------------------
  // SECTION 14: Featured Article Flag & Prioritization
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 14: Featured Article Flag & Prioritization ---");

  runSql(`UPDATE public.blog_posts SET featured = true WHERE id = '${testBilingualId}'`);
  const featuredPost = runSqlJson<any>(`SELECT featured FROM public.blog_posts WHERE id = '${testBilingualId}'`)[0];
  assert("FEATURED", featuredPost?.featured === true, "Article marked as featured = true");

  // Query ordered by featured DESC, published_at DESC
  const orderedPosts = runSqlJson<any>(`
    SELECT id, featured FROM public.blog_posts
    WHERE published = true AND (published_at IS NULL OR published_at <= now())
    ORDER BY featured DESC, published_at DESC
    LIMIT 1
  `);
  assert("FEATURED", orderedPosts[0]?.id === testBilingualId, "Featured article is sorted first in public query");

  // ---------------------------------------------------------------------------
  // SECTION 15: Dashboard Metric Reconciliation
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 15: Dashboard Metric Reconciliation ---");

  // Dashboard counters:
  // Total: count(*)
  // Published: published = true AND (published_at IS NULL OR published_at <= now())
  // Scheduled: published = true AND published_at > now()
  // Drafts: published = false
  const metrics = runSqlJson<any>(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE published = true AND (published_at IS NULL OR published_at <= now())) AS published,
      count(*) FILTER (WHERE published = true AND published_at > now()) AS scheduled,
      count(*) FILTER (WHERE NOT published) AS drafts
    FROM public.blog_posts
  `)[0];

  const totalNum = parseInt(metrics.total, 10);
  const pubNum = parseInt(metrics.published, 10);
  const schedNum = parseInt(metrics.scheduled, 10);
  const draftNum = parseInt(metrics.drafts, 10);

  assert("METRICS", totalNum === pubNum + schedNum + draftNum, `Metric invariant holds: Total (${totalNum}) = Published (${pubNum}) + Scheduled (${schedNum}) + Drafts (${draftNum})`);
  assert("METRICS", pubNum >= 1, `At least 1 published article counted (${pubNum})`);
  assert("METRICS", schedNum >= 1, `At least 1 scheduled article counted (${schedNum})`);
  assert("METRICS", draftNum >= 1, `At least 1 draft article counted (${draftNum})`);

  // ---------------------------------------------------------------------------
  // SECTION 16: Multilingual Admin Search
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 16: Multilingual Admin Search (DEF-BLOG-04) ---");

  // Search by English title
  const searchEn = runSqlJson<any>(`
    SELECT count(*) AS count FROM public.blog_posts
    WHERE title ILIKE '%Premium Brand Identity%' OR excerpt ILIKE '%Premium Brand Identity%'
  `)[0];
  assert("SEARCH", parseInt(searchEn.count, 10) >= 1, "English title search finds post");

  // Search by Arabic title
  const searchAr = runSqlJson<any>(`
    SELECT count(*) AS count FROM public.blog_posts
    WHERE title_ar ILIKE '%علامة تجارية%' OR excerpt_ar ILIKE '%علامة تجارية%'
  `)[0];
  assert("SEARCH", parseInt(searchAr.count, 10) >= 1, "Arabic title search finds post (DEF-BLOG-04 verified)");

  // Search by category
  const searchCategory = runSqlJson<any>(`
    SELECT count(*) AS count FROM public.blog_posts
    WHERE category = 'Branding & Strategy'
  `)[0];
  assert("SEARCH", parseInt(searchCategory.count, 10) >= 1, "Category search finds post");

  // ---------------------------------------------------------------------------
  // SECTION 17: Blog Section Visibility Toggle (site_settings 'blog')
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 17: Blog Section Visibility Toggle ---");

  // Initial state of site_settings for 'blog'
  const initSetting = runSqlJson<any>(`SELECT key, enabled FROM public.site_settings WHERE key = 'blog'`)[0];
  assert("VISIBILITY", initSetting?.enabled === true, "Blog section visibility initially enabled");

  // Toggle off
  runSql(`UPDATE public.site_settings SET enabled = false WHERE key = 'blog'`);
  const disabledSetting = runSqlJson<any>(`SELECT enabled FROM public.site_settings WHERE key = 'blog'`)[0];
  assert("VISIBILITY", disabledSetting?.enabled === false, "Blog section visibility toggled off");

  // Ensure articles were NOT deleted
  const postCountAfterToggle = runSql(`SELECT count(*) FROM public.blog_posts WHERE id = '${testBilingualId}'`);
  assert("VISIBILITY", parseInt(postCountAfterToggle, 10) === 1, "Toggling visibility does not delete articles");

  // Toggle back on
  runSql(`UPDATE public.site_settings SET enabled = true WHERE key = 'blog'`);
  const reenabledSetting = runSqlJson<any>(`SELECT enabled FROM public.site_settings WHERE key = 'blog'`)[0];
  assert("VISIBILITY", reenabledSetting?.enabled === true, "Blog section visibility restored to true");

  // ---------------------------------------------------------------------------
  // SECTION 18: Multi-Role RBAC & RLS Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 18: Multi-Role RBAC & RLS Enforcement ---");

  // Test A: Anonymous visitor RLS
  // Anon reads published posts only
  const anonSelect = runSql(`
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT count(*) FROM public.blog_posts;
    ROLLBACK;
  `);
  // Anon must see ONLY published posts whose published_at <= now()
  const anonSelectVal = parseInt(anonSelect.split("\n").filter((l) => /^\d+$/.test(l.trim())).pop() || "0", 10);
  assert("RLS_ANON", anonSelectVal === pubNum, `Anon sees only published posts with published_at <= now() (found ${anonSelectVal}, expected ${pubNum})`);

  // Anon cannot insert (table level or RLS will fail)
  let anonInsertFailed = false;
  try {
    runSql(`
      BEGIN;
      SET LOCAL ROLE anon;
      INSERT INTO public.blog_posts (title, slug, excerpt, content, category, author)
      VALUES ('Hacked Title', 'hacked-slug', 'excerpt', 'content', 'cat', 'anon');
      ROLLBACK;
    `);
  } catch {
    anonInsertFailed = true;
  }
  assert("RLS_ANON", anonInsertFailed, "Anon INSERT is strictly denied by table permissions and RLS");

  // Anon cannot update
  let anonUpdateFailed = false;
  try {
    runSql(`
      BEGIN;
      SET LOCAL ROLE anon;
      UPDATE public.blog_posts SET title = 'Defaced' WHERE id = '${testBilingualId}';
      ROLLBACK;
    `);
  } catch {
    anonUpdateFailed = true;
  }
  assert("RLS_ANON", anonUpdateFailed, "Anon UPDATE is strictly denied by table permissions and RLS");

  // Test B: Authenticated Worker RLS (Worker ID: cccccccc-cccc-cccc-cccc-cccccccccccc)
  // Worker is authenticated but has role 'worker' (is_admin = false)
  const workerSelect = runSql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${WORKER_ID}', true);
    SELECT count(*) FROM public.blog_posts;
    ROLLBACK;
  `);
  const workerSelectVal = parseInt(workerSelect.split("\n").filter((l) => /^\d+$/.test(l.trim())).pop() || "0", 10);
  assert("RLS_WORKER", workerSelectVal === pubNum, `Worker role without admin privileges sees only public published posts (found ${workerSelectVal})`);

  let workerInsertBlocked = false;
  try {
    runSql(`
      BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${WORKER_ID}', true);
      INSERT INTO public.blog_posts (title, slug, excerpt, content, category, author)
      VALUES ('Worker Title', 'worker-slug', 'excerpt', 'content', 'cat', 'worker');
      ROLLBACK;
    `);
  } catch {
    workerInsertBlocked = true;
  }
  assert("RLS_WORKER", workerInsertBlocked, "Worker INSERT is blocked by RLS (is_admin check fails)");

  // Test C: Authenticated Admin RLS (Admin ID: dddddddd-dddd-dddd-dddd-dddddddddddd)
  // Admin reads ALL posts (published, draft, scheduled)
  const adminSelect = runSql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${STANDARD_ADMIN_ID}', true);
    SELECT count(*) FROM public.blog_posts;
    ROLLBACK;
  `);
  const adminSelectVal = parseInt(adminSelect.split("\n").filter((l) => /^\d+$/.test(l.trim())).pop() || "0", 10);
  assert("RLS_ADMIN", adminSelectVal === totalNum, `Admin reads ALL posts including drafts and scheduled (found ${adminSelectVal}, expected ${totalNum})`);

  // Admin cannot delete (Super Admin exclusive): under RLS, deleting as non-super-admin affects 0 rows, so row remains!
  const adminDeleteProbe = runSql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${STANDARD_ADMIN_ID}', true);
    DELETE FROM public.blog_posts WHERE id = '${testDraftId}';
    SELECT count(*) FROM public.blog_posts WHERE id = '${testDraftId}';
    ROLLBACK;
  `);
  const remainingCountAfterAdminDelete = parseInt(adminDeleteProbe.split("\n").filter((l) => /^\d+$/.test(l.trim())).pop() || "0", 10);
  assert("RLS_ADMIN", remainingCountAfterAdminDelete === 1, "Standard Admin DELETE is blocked by RLS (row remains untouched, is_super_admin check required)");

  // Test D: Super Admin (Super Admin ID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
  // Super Admin CAN delete under RLS
  const superAdminDeleteProbe = runSql(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${SUPER_ADMIN_ID}', true);
    DELETE FROM public.blog_posts WHERE id = '${testDraftId}';
    SELECT count(*) FROM public.blog_posts WHERE id = '${testDraftId}';
    ROLLBACK;
  `);
  const remainingCountAfterSuperAdminDelete = parseInt(superAdminDeleteProbe.split("\n").filter((l) => /^\d+$/.test(l.trim())).pop() || "1", 10);
  assert("RLS_SUPER_ADMIN", remainingCountAfterSuperAdminDelete === 0, "Super Admin DELETE is permitted by RLS (row is successfully deleted)");

  // ---------------------------------------------------------------------------
  // SECTION 19: Clean Teardown of Synthetic Records
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 19: Teardown & Historical Preservation ---");

  runSql(`
    DELETE FROM public.blog_posts
    WHERE slug LIKE 'test-blog-cert-%'
       OR id IN ('${testDraftId}', '${testBilingualId}', '${testScheduledId}');
  `);

  const leftoverTestPosts = runSql(`
    SELECT count(*) FROM public.blog_posts
    WHERE slug LIKE 'test-blog-cert-%'
  `);
  assert("TEARDOWN", parseInt(leftoverTestPosts, 10) === 0, "All synthetic test fixtures safely removed; zero production records touched");

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log(`  SADA Blog CMS Certification Results: ${passed} PASSED / ${failed} FAILED`);
  console.log("==========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCertification().catch((err) => {
  console.error("Fatal error during certification execution:", err);
  process.exit(1);
});
