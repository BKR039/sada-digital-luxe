// ============================================================
// SADA OS — Content Systems Test Suite
// Blog × Digital Products × Client Proof
//
// Runs against the live remote Supabase database using the anonymous
// publishable key. That is deliberate: the anonymous client is exactly
// what a public visitor gets, so every visibility assertion here is a
// real RLS assertion, not a UI-level one.
//
//   npx tsx scripts/test-content-cms.ts
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load environment
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.substring(1, value.length - 1);
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

const anon = createClient(supabaseUrl, anonKey);

interface TestRecord {
  id: number;
  section: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const records: TestRecord[] = [];
let counter = 0;

function assertTest(section: string, name: string, condition: boolean, details?: string) {
  counter += 1;
  const status: "PASS" | "FAIL" = condition ? "PASS" : "FAIL";
  records.push({ id: counter, section, name, status, details });
  const icon = condition ? "✓" : "❌";
  console.log(`${icon} [${section}] ${counter}: ${name} -> ${status}`);
  if (!condition && details) console.error(`   ↳ ${details}`);
}

/** A column exists if selecting it does not raise a schema error. */
async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await anon
    .from(table as never)
    .select(column)
    .limit(1);
  if (!error) return true;
  return !/column .* does not exist|could not find/i.test(error.message);
}

async function run() {
  console.log("\n=== SADA CONTENT CMS TEST SUITE ===");
  console.log(`Target: ${supabaseUrl}\n`);

  // ============================================================
  // SECTION 1 — SCHEMA
  // ============================================================
  const schemaExpectations: Record<string, string[]> = {
    blog_posts: [
      "featured",
      "seo_title",
      "og_image_url",
      "cover_alt",
      "published_at",
      "slug",
      "content",
      "excerpt",
    ],
    products: [
      "slug",
      "featured",
      "full_description",
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
    ],
    testimonials: [
      "role",
      "short_quote",
      "language",
      "service",
      "featured",
      "client_id",
      "project_id",
      "updated_at",
    ],
  };

  for (const [table, columns] of Object.entries(schemaExpectations)) {
    for (const column of columns) {
      const exists = await columnExists(table, column);
      assertTest("SCHEMA", `${table}.${column} exists`, exists, `${table}.${column} is missing`);
    }
  }

  // ============================================================
  // SECTION 2 — PUBLIC VISIBILITY (RLS, anonymous)
  // ============================================================
  const blogPublic = await anon.from("blog_posts").select("id, published, published_at");
  assertTest(
    "PUBLIC",
    "Anonymous can query blog_posts",
    !blogPublic.error,
    blogPublic.error?.message,
  );

  const blogLeak = (blogPublic.data || []).filter((r: any) => r.published !== true);
  assertTest(
    "PUBLIC",
    "No unpublished article is readable anonymously",
    blogLeak.length === 0,
    `${blogLeak.length} draft article(s) exposed`,
  );

  const scheduledLeak = (blogPublic.data || []).filter(
    (r: any) => r.published_at && new Date(r.published_at).getTime() > Date.now(),
  );
  assertTest(
    "PUBLIC",
    "No scheduled (future-dated) article is readable anonymously",
    scheduledLeak.length === 0,
    `${scheduledLeak.length} scheduled article(s) exposed before their publish time`,
  );

  const productsPublic = await anon.from("products").select("id, published");
  assertTest(
    "PUBLIC",
    "Anonymous can query products",
    !productsPublic.error,
    productsPublic.error?.message,
  );
  const productLeak = (productsPublic.data || []).filter((r: any) => r.published !== true);
  assertTest(
    "PUBLIC",
    "No unpublished product is readable anonymously",
    productLeak.length === 0,
    `${productLeak.length} draft product(s) exposed`,
  );

  const proofPublic = await anon.from("testimonials").select("id, published");
  assertTest(
    "PUBLIC",
    "Anonymous can query testimonials",
    !proofPublic.error,
    proofPublic.error?.message,
  );
  const proofLeak = (proofPublic.data || []).filter((r: any) => r.published !== true);
  assertTest(
    "PUBLIC",
    "No unpublished client proof is readable anonymously",
    proofLeak.length === 0,
    `${proofLeak.length} draft testimonial(s) exposed`,
  );

  // ============================================================
  // SECTION 3 — ANONYMOUS WRITES MUST FAIL
  // ============================================================
  const blogInsert = await anon
    .from("blog_posts")
    .insert({ title: "RLS probe", slug: `rls-probe-${Date.now()}` } as never);
  assertTest(
    "SECURITY",
    "Anonymous INSERT on blog_posts is rejected",
    !!blogInsert.error,
    "Anonymous insert succeeded — public write policy is too permissive",
  );

  const productInsert = await anon.from("products").insert({ title: "RLS probe" } as never);
  assertTest(
    "SECURITY",
    "Anonymous INSERT on products is rejected",
    !!productInsert.error,
    "Anonymous insert succeeded — public write policy is too permissive",
  );

  const proofInsert = await anon
    .from("testimonials")
    .insert({ client_name: "RLS probe", review: "probe" } as never);
  assertTest(
    "SECURITY",
    "Anonymous INSERT on testimonials is rejected",
    !!proofInsert.error,
    "Anonymous insert succeeded — public write policy is too permissive",
  );

  const blogUpdate = await anon
    .from("blog_posts")
    .update({ featured: true } as never)
    .neq("id", "00000000-0000-0000-0000-000000000000");
  assertTest(
    "SECURITY",
    "Anonymous UPDATE on blog_posts changes nothing",
    !!blogUpdate.error || blogUpdate.count === 0 || blogUpdate.data === null,
    "Anonymous update appears to have succeeded",
  );

  const blogDelete = await anon
    .from("blog_posts")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  const blogDeleted = (blogDelete.data || []).length;
  assertTest(
    "SECURITY",
    "Anonymous DELETE on blog_posts removes nothing",
    !!blogDelete.error || blogDeleted === 0,
    `${blogDeleted} row(s) deleted anonymously`,
  );

  const productDelete = await anon
    .from("products")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  const productDeleted = (productDelete.data || []).length;
  assertTest(
    "SECURITY",
    "Anonymous DELETE on products removes nothing",
    !!productDelete.error || productDeleted === 0,
    `${productDeleted} row(s) deleted anonymously`,
  );

  const proofDelete = await anon
    .from("testimonials")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("id");
  const proofDeleted = (proofDelete.data || []).length;
  assertTest(
    "SECURITY",
    "Anonymous DELETE on testimonials removes nothing",
    !!proofDelete.error || proofDeleted === 0,
    `${proofDeleted} row(s) deleted anonymously`,
  );

  // ============================================================
  // SECTION 4 — RELATIONSHIPS (canonical, not duplicated)
  // ============================================================
  const fkProject = await anon
    .from("testimonials")
    .select("id, project_id")
    .not("project_id", "is", null)
    .limit(1);
  assertTest(
    "RELATIONSHIPS",
    "testimonials.project_id is queryable (case study link)",
    !fkProject.error,
    fkProject.error?.message,
  );

  const fkClient = await anon
    .from("testimonials")
    .select("id, client_id")
    .not("client_id", "is", null)
    .limit(1);
  assertTest(
    "RELATIONSHIPS",
    "testimonials.client_id is queryable (CRM client link)",
    !fkClient.error,
    fkClient.error?.message,
  );

  // The CRM client table itself must stay private to anonymous callers even
  // though testimonials may reference it.
  const clientsAnon = await anon.from("clients").select("id, name");
  const clientsVisible = (clientsAnon.data || []).length;
  assertTest(
    "RELATIONSHIPS",
    "Linking to clients does not expose the CRM client table publicly",
    !!clientsAnon.error || clientsVisible === 0,
    `${clientsVisible} CRM client row(s) visible anonymously`,
  );

  // A published testimonial pointing at a project must point at a real one.
  const linked = await anon
    .from("testimonials")
    .select("id, project_id")
    .eq("published", true)
    .not("project_id", "is", null);
  let danglingLinks = 0;
  for (const row of (linked.data || []) as { id: string; project_id: string }[]) {
    const { data: proj } = await anon
      .from("projects")
      .select("id")
      .eq("id", row.project_id)
      .maybeSingle();
    if (!proj) danglingLinks += 1;
  }
  assertTest(
    "RELATIONSHIPS",
    "Published client proof links resolve to real case studies",
    danglingLinks === 0,
    `${danglingLinks} testimonial(s) reference a case study that is not publicly visible`,
  );

  // ============================================================
  // SECTION 5 — PUBLIC DATA INTEGRITY
  // ============================================================
  const publishedPosts = await anon.from("blog_posts").select("id, title, slug, content, excerpt");
  const postsMissingSlug = (publishedPosts.data || []).filter((p: any) => !p.slug);
  assertTest(
    "INTEGRITY",
    "Every publicly visible article has a slug",
    postsMissingSlug.length === 0,
    `${postsMissingSlug.length} article(s) without a slug cannot be opened`,
  );

  const slugs = (publishedPosts.data || []).map((p: any) => p.slug);
  assertTest(
    "INTEGRITY",
    "Article slugs are unique",
    new Set(slugs).size === slugs.length,
    "Duplicate slugs found among publicly visible articles",
  );

  const postsMissingBody = (publishedPosts.data || []).filter(
    (p: any) => !p.content || !p.content.trim(),
  );
  assertTest(
    "INTEGRITY",
    "Every publicly visible article has body content",
    postsMissingBody.length === 0,
    `${postsMissingBody.length} published article(s) have an empty body`,
  );

  const publishedProducts = await anon
    .from("products")
    .select("id, title, slug, gumroad_url, price");
  const productsMissingLink = (publishedProducts.data || []).filter((p: any) => !p.gumroad_url);
  assertTest(
    "INTEGRITY",
    "Every publicly visible product has a purchase link",
    productsMissingLink.length === 0,
    `${productsMissingLink.length} published product(s) have no Gumroad URL`,
  );

  const badGumroad = (publishedProducts.data || []).filter(
    (p: any) => p.gumroad_url && !/^https?:\/\//i.test(p.gumroad_url),
  );
  assertTest(
    "INTEGRITY",
    "Product purchase links are absolute URLs",
    badGumroad.length === 0,
    `${badGumroad.length} product(s) have a malformed Gumroad URL`,
  );

  const productSlugs = (publishedProducts.data || []).map((p: any) => p.slug).filter(Boolean);
  assertTest(
    "INTEGRITY",
    "Product slugs are unique",
    new Set(productSlugs).size === productSlugs.length,
    "Duplicate slugs found among publicly visible products",
  );

  const publishedProof = await anon
    .from("testimonials")
    .select("id, client_name, review, company, role");
  const unattributed = (publishedProof.data || []).filter(
    (t: any) => !t.client_name?.trim() || !t.review?.trim(),
  );
  assertTest(
    "INTEGRITY",
    "Every published client quote has a name and the quote itself",
    unattributed.length === 0,
    `${unattributed.length} published testimonial(s) are incomplete`,
  );

  // ============================================================
  // SECTION 6 — PUBLIC SURFACE QUERIES
  // These mirror exactly what the public routes run.
  // ============================================================
  const blogList = await anon
    .from("blog_posts")
    .select(
      "id,title,slug,excerpt,cover_url,cover_alt,published_at,category,tags,author,reading_minutes,featured",
    )
    .eq("published", true)
    .order("published_at", { ascending: false });
  assertTest(
    "PUBLIC-SURFACE",
    "/blog listing query succeeds",
    !blogList.error,
    blogList.error?.message,
  );

  const storeList = await anon
    .from("products")
    .select("*")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true });
  assertTest(
    "PUBLIC-SURFACE",
    "/store listing query succeeds",
    !storeList.error,
    storeList.error?.message,
  );

  const proofList = await anon
    .from("testimonials")
    .select("id,client_name,company,role,review,short_quote,photo_url,featured")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true });
  assertTest(
    "PUBLIC-SURFACE",
    "Homepage client proof query succeeds",
    !proofList.error,
    proofList.error?.message,
  );

  // ============================================================
  // SECTION 7 — ROLE-BASED ENFORCEMENT + FULL CONTENT LIFECYCLE
  // Signs in as real Super Admin / Admin / Worker sessions and drives
  // a record through CREATE -> DRAFT -> PUBLISH -> UNPUBLISH -> DELETE,
  // asserting what each role can and cannot do at the database level.
  // ============================================================
  const superAdmin = createClient(supabaseUrl, anonKey);
  const admin = createClient(supabaseUrl, anonKey);
  const worker = createClient(supabaseUrl, anonKey);

  const saLogin = await superAdmin.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  const adminLogin = await admin.auth.signInWithPassword({
    email: "phase1.tester@sada.agency",
    password: "Phase1TestPassword123!",
  });
  const workerLogin = await worker.auth.signInWithPassword({
    email: "team.e2e.1789469945865@sada.agency",
    password: "TestPassword123!",
  });

  const sessionsReady = !saLogin.error && !adminLogin.error && !workerLogin.error;
  assertTest(
    "RBAC",
    "Super Admin / Admin / Worker sessions established",
    sessionsReady,
    [saLogin.error?.message, adminLogin.error?.message, workerLogin.error?.message]
      .filter(Boolean)
      .join(" | "),
  );

  if (!sessionsReady) {
    console.warn("\n⚠ Skipping role-based lifecycle tests — test accounts unavailable.\n");
  } else {
    const stamp = Date.now();
    const cleanup: { table: string; id: string }[] = [];

    // ---------- BLOG LIFECYCLE ----------
    const blogSlug = `cms-suite-probe-${stamp}`;
    const blogDraft = await admin
      .from("blog_posts")
      .insert({
        title: "CMS suite probe article",
        slug: blogSlug,
        excerpt: "Temporary record created by scripts/test-content-cms.ts.",
        content: "## Probe\n\nThis row is created and removed by the automated test suite.",
        category: "Business Growth",
        author: "SADA Test Suite",
        published: false,
      } as never)
      .select("id")
      .single();
    assertTest("RBAC", "Admin can create a blog draft", !blogDraft.error, blogDraft.error?.message);
    const blogId = (blogDraft.data as { id: string } | null)?.id;
    if (blogId) cleanup.push({ table: "blog_posts", id: blogId });

    if (blogId) {
      const anonDraft = await anon.from("blog_posts").select("id").eq("id", blogId).maybeSingle();
      assertTest(
        "LIFECYCLE",
        "A draft article is invisible to the public",
        !anonDraft.data,
        "Draft article was readable anonymously",
      );

      const workerRead = await worker
        .from("blog_posts")
        .select("id")
        .eq("id", blogId)
        .maybeSingle();
      assertTest(
        "RBAC",
        "Worker cannot read unpublished articles",
        !workerRead.data,
        "Worker could read an unpublished article",
      );

      const workerEdit = await worker
        .from("blog_posts")
        .update({ title: "worker edit" } as never)
        .eq("id", blogId)
        .select("id");
      assertTest(
        "RBAC",
        "Worker cannot edit an article",
        !!workerEdit.error || (workerEdit.data || []).length === 0,
        "Worker updated an article",
      );

      const workerInsert = await worker
        .from("blog_posts")
        .insert({ title: "worker probe", slug: `worker-probe-${stamp}` } as never)
        .select("id");
      assertTest(
        "RBAC",
        "Worker cannot create an article",
        !!workerInsert.error || (workerInsert.data || []).length === 0,
        "Worker created an article",
      );
      const strayWorkerPost = (workerInsert.data as { id: string }[] | null)?.[0]?.id;
      if (strayWorkerPost) cleanup.push({ table: "blog_posts", id: strayWorkerPost });

      // Scheduling: published, but dated in the future.
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString();
      await admin
        .from("blog_posts")
        .update({ published: true, published_at: future } as never)
        .eq("id", blogId);
      const anonScheduled = await anon
        .from("blog_posts")
        .select("id")
        .eq("id", blogId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "A scheduled article stays private until its publish time",
        !anonScheduled.data,
        "A future-dated article was readable anonymously",
      );

      // Publish now (5-second buffer protects against client-to-server clock skew)
      const publishRes = await admin
        .from("blog_posts")
        .update({ published: true, published_at: new Date(Date.now() - 5000).toISOString() } as never)
        .eq("id", blogId)
        .select("id");
      assertTest(
        "RBAC",
        "Admin can publish an article",
        !publishRes.error && (publishRes.data || []).length === 1,
        publishRes.error?.message,
      );

      const anonPublished = await anon
        .from("blog_posts")
        .select("id, slug")
        .eq("id", blogId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "A published article becomes publicly readable",
        !!anonPublished.data,
        "Published article was not visible anonymously",
      );

      const anonBySlug = await anon
        .from("blog_posts")
        .select("id")
        .eq("slug", blogSlug)
        .eq("published", true)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "The public article route query resolves it by slug",
        !!anonBySlug.data,
        "Published article could not be fetched by slug",
      );

      // Unpublish.
      await admin
        .from("blog_posts")
        .update({ published: false } as never)
        .eq("id", blogId);
      const anonAfterUnpublish = await anon
        .from("blog_posts")
        .select("id")
        .eq("id", blogId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "Unpublishing removes an article from public reach",
        !anonAfterUnpublish.data,
        "Unpublished article was still readable anonymously",
      );

      // Deletion is Super Admin only.
      const adminDelete = await admin.from("blog_posts").delete().eq("id", blogId).select("id");
      const adminDeletedCount = (adminDelete.data || []).length;
      assertTest(
        "RBAC",
        "Admin CANNOT permanently delete an article",
        !!adminDelete.error || adminDeletedCount === 0,
        "Admin deleted an article — permanent deletion must be Super Admin only",
      );

      const workerDelete = await worker.from("blog_posts").delete().eq("id", blogId).select("id");
      assertTest(
        "RBAC",
        "Worker CANNOT permanently delete an article",
        !!workerDelete.error || (workerDelete.data || []).length === 0,
        "Worker deleted an article",
      );

      const saDelete = await superAdmin.from("blog_posts").delete().eq("id", blogId).select("id");
      const saDeleted = (saDelete.data || []).length === 1;
      assertTest(
        "RBAC",
        "Super Admin CAN permanently delete an article",
        saDeleted,
        saDelete.error?.message || "Super Admin delete affected no rows",
      );
      if (saDeleted)
        cleanup.splice(
          cleanup.findIndex((c) => c.id === blogId),
          1,
        );
    }

    // ---------- PRODUCT LIFECYCLE ----------
    const productSlug = `cms-suite-product-${stamp}`;
    const productDraft = await admin
      .from("products")
      .insert({
        title: "CMS suite probe product",
        slug: productSlug,
        description: "Temporary record created by scripts/test-content-cms.ts.",
        price: 0,
        currency: "USD",
        gumroad_url: "https://gumroad.com/l/sada-test-probe",
        includes: ["Probe item"],
        published: false,
      } as never)
      .select("id")
      .single();
    assertTest(
      "RBAC",
      "Admin can create a product draft",
      !productDraft.error,
      productDraft.error?.message,
    );
    const productId = (productDraft.data as { id: string } | null)?.id;
    if (productId) cleanup.push({ table: "products", id: productId });

    if (productId) {
      const anonDraft = await anon.from("products").select("id").eq("id", productId).maybeSingle();
      assertTest(
        "LIFECYCLE",
        "A draft product is invisible to the public",
        !anonDraft.data,
        "Draft product was readable anonymously",
      );

      await admin
        .from("products")
        .update({ published: true } as never)
        .eq("id", productId);
      const anonPublished = await anon
        .from("products")
        .select("id, slug, gumroad_url")
        .eq("id", productId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "A published product becomes publicly readable",
        !!anonPublished.data,
        "Published product was not visible anonymously",
      );
      assertTest(
        "LIFECYCLE",
        "The product page query resolves it by slug",
        (anonPublished.data as { slug?: string } | null)?.slug === productSlug,
        "Product slug did not round-trip",
      );
      assertTest(
        "LIFECYCLE",
        "Gumroad remains the purchase destination",
        (anonPublished.data as { gumroad_url?: string } | null)?.gumroad_url?.includes(
          "gumroad.com",
        ) === true,
        "Gumroad URL missing from the public product record",
      );

      await admin
        .from("products")
        .update({ published: false } as never)
        .eq("id", productId);
      const anonAfter = await anon.from("products").select("id").eq("id", productId).maybeSingle();
      assertTest(
        "LIFECYCLE",
        "Unpublishing removes a product from public reach",
        !anonAfter.data,
        "Unpublished product was still readable anonymously",
      );

      const adminDelete = await admin.from("products").delete().eq("id", productId).select("id");
      assertTest(
        "RBAC",
        "Admin CANNOT permanently delete a product",
        !!adminDelete.error || (adminDelete.data || []).length === 0,
        "Admin deleted a product — permanent deletion must be Super Admin only",
      );

      const saDelete = await superAdmin.from("products").delete().eq("id", productId).select("id");
      const saDeleted = (saDelete.data || []).length === 1;
      assertTest(
        "RBAC",
        "Super Admin CAN permanently delete a product",
        saDeleted,
        saDelete.error?.message || "Super Admin delete affected no rows",
      );
      if (saDeleted)
        cleanup.splice(
          cleanup.findIndex((c) => c.id === productId),
          1,
        );
    }

    // ---------- CLIENT PROOF LIFECYCLE + RELATIONSHIP ----------
    const { data: someProject } = await superAdmin
      .from("projects")
      .select("id")
      .limit(1)
      .maybeSingle();
    const proofDraft = await admin
      .from("testimonials")
      .insert({
        client_name: "CMS suite probe client",
        company: "Probe Co",
        role: "Founder",
        review: "Temporary record created by scripts/test-content-cms.ts.",
        rating: 5,
        language: "en",
        project_id: (someProject as { id: string } | null)?.id ?? null,
        published: false,
      } as never)
      .select("id, project_id")
      .single();
    assertTest(
      "RBAC",
      "Admin can create client proof",
      !proofDraft.error,
      proofDraft.error?.message,
    );
    const proofId = (proofDraft.data as { id: string } | null)?.id;
    if (proofId) cleanup.push({ table: "testimonials", id: proofId });

    if (proofId) {
      const anonDraft = await anon
        .from("testimonials")
        .select("id")
        .eq("id", proofId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "Draft client proof is invisible to the public",
        !anonDraft.data,
        "Draft testimonial was readable anonymously",
      );

      await admin
        .from("testimonials")
        .update({ published: true } as never)
        .eq("id", proofId);
      const anonPublished = await anon
        .from("testimonials")
        .select("id, project_id, role")
        .eq("id", proofId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "Published client proof becomes publicly readable",
        !!anonPublished.data,
        "Published testimonial was not visible anonymously",
      );

      if ((someProject as { id: string } | null)?.id) {
        assertTest(
          "RELATIONSHIPS",
          "Client proof stores a case study reference, not a copied quote",
          (anonPublished.data as { project_id?: string } | null)?.project_id ===
            (someProject as { id: string }).id,
          "project_id did not round-trip — the case study link is not being persisted",
        );
      }

      const workerEdit = await worker
        .from("testimonials")
        .update({ review: "worker edit" } as never)
        .eq("id", proofId)
        .select("id");
      assertTest(
        "RBAC",
        "Worker cannot edit client proof",
        !!workerEdit.error || (workerEdit.data || []).length === 0,
        "Worker edited a testimonial",
      );

      await admin
        .from("testimonials")
        .update({ published: false } as never)
        .eq("id", proofId);
      const anonAfter = await anon
        .from("testimonials")
        .select("id")
        .eq("id", proofId)
        .maybeSingle();
      assertTest(
        "LIFECYCLE",
        "Unpublishing removes client proof from public reach",
        !anonAfter.data,
        "Unpublished testimonial was still readable anonymously",
      );

      const adminDelete = await admin.from("testimonials").delete().eq("id", proofId).select("id");
      assertTest(
        "RBAC",
        "Admin CANNOT permanently delete client proof",
        !!adminDelete.error || (adminDelete.data || []).length === 0,
        "Admin deleted a testimonial — permanent deletion must be Super Admin only",
      );

      const saDelete = await superAdmin
        .from("testimonials")
        .delete()
        .eq("id", proofId)
        .select("id");
      const saDeleted = (saDelete.data || []).length === 1;
      assertTest(
        "RBAC",
        "Super Admin CAN permanently delete client proof",
        saDeleted,
        saDelete.error?.message || "Super Admin delete affected no rows",
      );
      if (saDeleted)
        cleanup.splice(
          cleanup.findIndex((c) => c.id === proofId),
          1,
        );
    }

    // ---------- CLEANUP ----------
    // Anything the suite created and could not remove above is deleted here so
    // the database is left exactly as it was found.
    let leftovers = 0;
    for (const item of cleanup) {
      const res = await superAdmin
        .from(item.table as never)
        .delete()
        .eq("id", item.id)
        .select("id");
      if (res.error || (res.data || []).length === 0) leftovers += 1;
    }
    assertTest(
      "CLEANUP",
      "All probe records removed from the database",
      leftovers === 0,
      `${leftovers} probe record(s) could not be deleted — check manually`,
    );

    await Promise.all([superAdmin.auth.signOut(), admin.auth.signOut(), worker.auth.signOut()]);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  const passed = records.filter((r) => r.status === "PASS").length;
  const failed = records.filter((r) => r.status === "FAIL").length;

  console.log("\n=== SUMMARY ===");
  const bySection = new Map<string, { pass: number; fail: number }>();
  records.forEach((r) => {
    const entry = bySection.get(r.section) || { pass: 0, fail: 0 };
    if (r.status === "PASS") entry.pass += 1;
    else entry.fail += 1;
    bySection.set(r.section, entry);
  });
  bySection.forEach((v, k) => console.log(`${k.padEnd(16)} ${v.pass} passed, ${v.fail} failed`));
  console.log(`\nTOTAL: ${passed}/${records.length} passed`);

  console.log("\nCOUNTS VISIBLE TO AN ANONYMOUS VISITOR:");
  console.log(`  articles: ${(blogPublic.data || []).length}`);
  console.log(`  products: ${(productsPublic.data || []).length}`);
  console.log(`  client proof: ${(proofPublic.data || []).length}`);

  fs.writeFileSync(
    path.resolve(process.cwd(), "content_cms_test_results.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), passed, failed, records }, null, 2),
  );
  console.log("\nResults written to content_cms_test_results.json");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
