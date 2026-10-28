// ============================================================
// SADA WORK OS — CONTENT CMS SERVICE
// Authoritative server/service boundary mutations & publishing
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import { normalizeRole, type PermissionContext } from "@/lib/permissions";
import { logSystemAudit } from "@/lib/audit-service";

export interface ContentMutationOptions {
  ctx?: PermissionContext;
  actorRole?: string;
  actorId?: string;
  role?: string;
  id?: string;
  client?: any;
  clientOverride?: any;
}

// ------------------------------------------------------------
// 1. PROJECTS / CASE STUDIES
// ------------------------------------------------------------

export async function createProjectItem(
  payload: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
  });

  const { data, error } = await (activeClient as any)
    .from("projects")
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectItem(
  id: string,
  updates: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "content_project",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("projects")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function publishProjectItem(
  id: string,
  published: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "publish", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "content_project",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("projects")
    .update({
      published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProjectItem(
  id: string,
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "content_project",
    resource: { id },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any)
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ------------------------------------------------------------
// 2. BLOG POSTS
// ------------------------------------------------------------

export async function createBlogPost(
  payload: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resourceAction: "write",
  });

  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new Error("Article title is required.");
  }

  if (!payload.slug || typeof payload.slug !== "string" || !payload.slug.trim()) {
    throw new Error("Article URL slug is required.");
  }

  const cleanSlug = payload.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
    throw new Error("Slug must contain only lowercase alphanumeric characters and hyphens.");
  }

  // Pre-check slug uniqueness
  const { data: clash } = await (activeClient as any)
    .from("blog_posts")
    .select("id")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (clash) {
    throw new Error(`The slug "${cleanSlug}" is already in use by another article.`);
  }

  const nowIso = new Date().toISOString();
  const insertPayload = {
    ...payload,
    slug: cleanSlug,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    featured: Boolean(payload.featured),
    published: Boolean(payload.published),
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await (activeClient as any)
    .from("blog_posts")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateBlogPost(
  id: string,
  updates: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resource: { id },
    resourceAction: "write",
  });

  if (updates.slug) {
    const cleanSlug = updates.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      throw new Error("Slug must contain only lowercase alphanumeric characters and hyphens.");
    }

    const { data: clash } = await (activeClient as any)
      .from("blog_posts")
      .select("id")
      .eq("slug", cleanSlug)
      .neq("id", id)
      .maybeSingle();

    if (clash) {
      throw new Error(`The slug "${cleanSlug}" is already in use by another article.`);
    }
    updates.slug = cleanSlug;
  }

  const { data, error } = await (activeClient as any)
    .from("blog_posts")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function publishBlogPost(
  id: string,
  published: boolean,
  publishedAt?: string | null,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "publish", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resource: { id },
    resourceAction: "write",
  });

  let nextPublishedAt: string | null = publishedAt || null;
  if (published && !nextPublishedAt) {
    // Back-buffer by 5s to guarantee immediate database visibility despite clock skew
    nextPublishedAt = new Date(Date.now() - 5000).toISOString();
  }

  const { data, error } = await (activeClient as any)
    .from("blog_posts")
    .update({
      published,
      published_at: published ? nextPublishedAt : publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function setFeaturedBlogPost(
  id: string,
  featured: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("blog_posts")
    .update({
      featured,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBlogPost(
  id: string,
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resource: { id },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any)
    .from("blog_posts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function toggleBlogVisibility(
  enabled: boolean,
  options?: ContentMutationOptions
): Promise<{ enabled: boolean }> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "blog_post",
    resourceAction: "write",
  });

  const { error } = await (activeClient as any)
    .from("site_settings")
    .upsert(
      {
        key: "blog",
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) throw error;
  return { enabled };
}

// ------------------------------------------------------------
// 3. DIGITAL PRODUCTS
// ------------------------------------------------------------

export function validateGumroadUrl(url: string | null | undefined): {
  isValid: boolean;
  normalizedUrl: string | null;
  error?: string;
} {
  if (!url || typeof url !== "string" || !url.trim()) {
    return { isValid: true, normalizedUrl: null };
  }
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: null,
      error: "Gumroad URL must begin with http:// or https://",
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isValid: false,
        normalizedUrl: null,
        error: "Unsafe URL scheme detected. Only HTTP/HTTPS protocols are permitted.",
      };
    }
    return { isValid: true, normalizedUrl: parsed.href };
  } catch {
    return {
      isValid: false,
      normalizedUrl: null,
      error: "Invalid URL format.",
    };
  }
}

export interface ProductReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
}

export function validateProductReadiness(product: Record<string, any>): {
  score: number;
  checks: ProductReadinessCheck[];
  allPassed: boolean;
} {
  const title = (product.title || "").trim();
  const slug = (product.slug || "").trim();
  const description = (product.description || "").trim();
  const thumbnail = (product.thumbnail_url || "").trim();
  const rawPrice = product.price;
  const parsedPrice =
    rawPrice === null || rawPrice === undefined || rawPrice === "" ? null : Number(rawPrice);
  const priceValid = parsedPrice !== null && !Number.isNaN(parsedPrice) && parsedPrice >= 0;
  const gumroadUrl = (product.gumroad_url || "").trim();
  const gumroadCheck = validateGumroadUrl(gumroadUrl);
  const gumroadValid = gumroadUrl.length > 0 && gumroadCheck.isValid;

  const checks: ProductReadinessCheck[] = [
    { id: "title", label: "Product name is set", passed: title.length > 0 },
    {
      id: "slug",
      label: "Valid URL slug",
      passed: slug.length > 0 && /^[a-z0-9-]+$/.test(slug),
    },
    { id: "desc", label: "Short description written", passed: description.length > 20 },
    { id: "cover", label: "Cover image uploaded", passed: thumbnail.length > 0 },
    {
      id: "price",
      label: "Price set (0 is valid for a free product)",
      passed: priceValid,
    },
    {
      id: "gumroad",
      label: "Gumroad purchase link added",
      passed: gumroadValid,
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    score: passedCount,
    checks,
    allPassed: passedCount === checks.length,
  };
}

export async function createDigitalProduct(
  payload: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resourceAction: "write",
  });

  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new Error("Product title is required.");
  }

  let cleanSlug = payload.slug ? String(payload.slug).trim().toLowerCase() : "";
  if (cleanSlug) {
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      throw new Error("Slug must contain only lowercase alphanumeric characters and hyphens.");
    }
    const { data: clash } = await (activeClient as any)
      .from("products")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (clash) {
      throw new Error(`The slug "${cleanSlug}" is already in use by another product.`);
    }
  }

  if (payload.gumroad_url) {
    const check = validateGumroadUrl(payload.gumroad_url);
    if (!check.isValid) {
      throw new Error(check.error || "Invalid Gumroad purchase URL.");
    }
  }

  if (payload.price !== undefined && payload.price !== null && payload.price !== "") {
    const num = Number(payload.price);
    if (Number.isNaN(num) || num < 0) {
      throw new Error("Product price must be a number of 0 or more.");
    }
  }

  const isPublishing = Boolean(payload.published);
  if (isPublishing) {
    const readiness = validateProductReadiness({ ...payload, slug: cleanSlug });
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish product: missing required readiness criteria (${missing}).`);
    }
  }

  const nowIso = new Date().toISOString();
  const insertPayload = {
    ...payload,
    slug: cleanSlug || null,
    price:
      payload.price !== undefined && payload.price !== null && payload.price !== ""
        ? Number(payload.price)
        : null,
    published: isPublishing,
    featured: Boolean(payload.featured),
    sort_order: typeof payload.sort_order === "number" ? payload.sort_order : 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await (activeClient as any)
    .from("products")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "PRODUCT_CREATE",
    entityType: "digital_product",
    entityId: data.id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { title: data.title, slug: data.slug, published: data.published, price: data.price },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function updateDigitalProduct(
  id: string,
  updates: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resource: { id },
    resourceAction: "write",
  });

  if (updates.title !== undefined) {
    if (typeof updates.title !== "string" || !updates.title.trim()) {
      throw new Error("Product title cannot be empty.");
    }
  }

  if (updates.slug !== undefined) {
    let cleanSlug = updates.slug ? String(updates.slug).trim().toLowerCase() : "";
    if (cleanSlug) {
      if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
        throw new Error("Slug must contain only lowercase alphanumeric characters and hyphens.");
      }
      const { data: clash } = await (activeClient as any)
        .from("products")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", id)
        .maybeSingle();

      if (clash) {
        throw new Error(`The slug "${cleanSlug}" is already in use by another product.`);
      }
      updates.slug = cleanSlug;
    } else {
      updates.slug = null;
    }
  }

  if (updates.gumroad_url !== undefined && updates.gumroad_url !== null) {
    const check = validateGumroadUrl(updates.gumroad_url);
    if (!check.isValid) {
      throw new Error(check.error || "Invalid Gumroad purchase URL.");
    }
  }

  if (updates.price !== undefined && updates.price !== null && updates.price !== "") {
    const num = Number(updates.price);
    if (Number.isNaN(num) || num < 0) {
      throw new Error("Product price must be a number of 0 or more.");
    }
  }

  if (updates.published === true) {
    const { data: current } = await (activeClient as any)
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    const merged = { ...(current || {}), ...updates };
    const readiness = validateProductReadiness(merged);
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish product: missing required readiness criteria (${missing}).`);
    }
  }

  const { data, error } = await (activeClient as any)
    .from("products")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "PRODUCT_UPDATE",
    entityType: "digital_product",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: updates,
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function publishDigitalProduct(
  id: string,
  published: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "publish", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resource: { id },
    resourceAction: "write",
  });

  if (published) {
    const { data: current, error: readErr } = await (activeClient as any)
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (readErr || !current) throw new Error("Product not found.");

    const readiness = validateProductReadiness(current);
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish product: missing required readiness criteria (${missing}).`);
    }
  }

  const { data, error } = await (activeClient as any)
    .from("products")
    .update({
      published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: published ? "PRODUCT_PUBLISH" : "PRODUCT_UNPUBLISH",
    entityType: "digital_product",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { published },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function setFeaturedDigitalProduct(
  id: string,
  featured: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("products")
    .update({
      featured,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "PRODUCT_FEATURE_TOGGLE",
    entityType: "digital_product",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { featured },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function duplicateDigitalProduct(
  id: string,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resourceAction: "write",
  });

  const { data: orig, error: readErr } = await (activeClient as any)
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (readErr || !orig) throw new Error("Original product not found for duplication.");

  const { id: _id, created_at: _c, updated_at: _u, ...rest } = orig;
  const suffix = Math.random().toString(36).slice(2, 7);
  const baseSlug = orig.slug
    ? orig.slug
    : (orig.title || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const newSlug = `${baseSlug}-copy-${suffix}`;

  const payload = {
    ...rest,
    title: `${orig.title} (copy)`,
    slug: newSlug,
    published: false,
    featured: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (activeClient as any)
    .from("products")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "PRODUCT_DUPLICATE",
    entityType: "digital_product",
    entityId: data.id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { originalId: id, newId: data.id, slug: newSlug },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function deleteDigitalProduct(
  id: string,
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "digital_product",
    resource: { id },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any).from("products").delete().eq("id", id);

  if (error) throw error;

  logSystemAudit({
    action: "PRODUCT_DELETE",
    entityType: "digital_product",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    client: activeClient,
  }).catch(() => {});
}

// ------------------------------------------------------------
// 4. TESTIMONIALS / CLIENT PROOF
// ------------------------------------------------------------

export interface TestimonialReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface TestimonialReadinessResult {
  checks: TestimonialReadinessCheck[];
  allPassed: boolean;
  passedCount: number;
  passed: number;
  totalCount: number;
}

export function validateTestimonialReadiness(
  testimonial: Partial<{
    client_name?: string | null;
    review?: string | null;
    company?: string | null;
    role?: string | null;
    client_id?: string | null;
    project_id?: string | null;
  }>
): TestimonialReadinessResult {
  const namePassed = !!(testimonial.client_name && testimonial.client_name.trim().length > 0);
  const quotePassed = !!(testimonial.review && testimonial.review.trim().length > 20);
  const attributionPassed = !!(
    (testimonial.company && testimonial.company.trim().length > 0) ||
    (testimonial.role && testimonial.role.trim().length > 0)
  );
  const verifiedPassed = !!(
    (testimonial.client_id && String(testimonial.client_id).trim().length > 0) ||
    (testimonial.project_id && String(testimonial.project_id).trim().length > 0)
  );

  const checks: TestimonialReadinessCheck[] = [
    { id: "name", label: "Client name recorded", passed: namePassed },
    { id: "quote", label: "Full quote captured", passed: quotePassed },
    { id: "attribution", label: "Attribution is complete (company or role)", passed: attributionPassed },
    { id: "verified", label: "Linked to a CRM client or a case study", passed: verifiedPassed },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    checks,
    allPassed: passedCount === checks.length,
    passedCount,
    passed: passedCount,
    totalCount: checks.length,
  };
}

export async function createTestimonial(
  payload: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "testimonial",
    resourceAction: "write",
  });

  const clientName = (payload.client_name || "").trim();
  const review = (payload.review || "").trim();
  if (!clientName) {
    throw new Error("Client name cannot be empty.");
  }
  if (!review) {
    throw new Error("Testimonial review quote cannot be empty.");
  }

  const isPublished = payload.published === true;
  if (isPublished) {
    const readiness = validateTestimonialReadiness(payload);
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish client proof: missing required readiness criteria (${missing}).`);
    }
  }

  const { data, error } = await (activeClient as any)
    .from("testimonials")
    .insert({
      client_name: clientName,
      company: payload.company ? String(payload.company).trim() : null,
      role: payload.role ? String(payload.role).trim() : null,
      photo_url: payload.photo_url || null,
      review,
      short_quote: payload.short_quote ? String(payload.short_quote).trim() : null,
      language: payload.language || "en",
      service: payload.service ? String(payload.service).trim() : null,
      client_id: payload.client_id || null,
      project_id: payload.project_id || null,
      featured: !!payload.featured,
      sort_order: payload.sort_order ?? 0,
      rating: payload.rating ?? 5,
      published: isPublished,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "TESTIMONIAL_CREATE",
    entityType: "testimonial",
    entityId: data.id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { client_name: clientName, published: isPublished },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function updateTestimonial(
  id: string,
  updates: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "testimonial",
    resource: { id },
    resourceAction: "write",
  });

  if (updates.client_name !== undefined) {
    if (typeof updates.client_name !== "string" || !updates.client_name.trim()) {
      throw new Error("Client name cannot be empty.");
    }
  }

  if (updates.review !== undefined) {
    if (typeof updates.review !== "string" || !updates.review.trim()) {
      throw new Error("Testimonial review quote cannot be empty.");
    }
  }

  if (updates.published === true) {
    const { data: current, error: readErr } = await (activeClient as any)
      .from("testimonials")
      .select("*")
      .eq("id", id)
      .single();

    if (readErr || !current) throw new Error("Client proof not found.");

    const merged = { ...current, ...updates };
    const readiness = validateTestimonialReadiness(merged);
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish client proof: missing required readiness criteria (${missing}).`);
    }
  }

  const cleanUpdates: Record<string, any> = { ...updates };
  if (cleanUpdates.client_name !== undefined) cleanUpdates.client_name = cleanUpdates.client_name.trim();
  if (cleanUpdates.review !== undefined) cleanUpdates.review = cleanUpdates.review.trim();
  if (cleanUpdates.company !== undefined && cleanUpdates.company !== null) {
    cleanUpdates.company = String(cleanUpdates.company).trim() || null;
  }
  if (cleanUpdates.role !== undefined && cleanUpdates.role !== null) {
    cleanUpdates.role = String(cleanUpdates.role).trim() || null;
  }
  if (cleanUpdates.short_quote !== undefined && cleanUpdates.short_quote !== null) {
    cleanUpdates.short_quote = String(cleanUpdates.short_quote).trim() || null;
  }
  cleanUpdates.updated_at = new Date().toISOString();

  const { data, error } = await (activeClient as any)
    .from("testimonials")
    .update(cleanUpdates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: "TESTIMONIAL_UPDATE",
    entityType: "testimonial",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: cleanUpdates,
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function publishTestimonial(
  id: string,
  published: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "publish", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "testimonial",
    resource: { id },
    resourceAction: "write",
  });

  if (published) {
    const { data: current, error: readErr } = await (activeClient as any)
      .from("testimonials")
      .select("*")
      .eq("id", id)
      .single();

    if (readErr || !current) throw new Error("Client proof not found.");

    const readiness = validateTestimonialReadiness(current);
    if (!readiness.allPassed) {
      const missing = readiness.checks.filter((c) => !c.passed).map((c) => c.label).join(", ");
      throw new Error(`Cannot publish client proof: missing required readiness criteria (${missing}).`);
    }
  }

  const { data, error } = await (activeClient as any)
    .from("testimonials")
    .update({
      published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: published ? "TESTIMONIAL_PUBLISH" : "TESTIMONIAL_UNPUBLISH",
    entityType: "testimonial",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { published },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function setFeaturedTestimonial(
  id: string,
  featured: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "testimonial",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("testimonials")
    .update({
      featured,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  logSystemAudit({
    action: featured ? "TESTIMONIAL_FEATURE" : "TESTIMONIAL_UNFEATURE",
    entityType: "testimonial",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    newValues: { featured },
    client: activeClient,
  }).catch(() => {});

  return data;
}

export async function deleteTestimonial(
  id: string,
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  const secCtx = await assertAuthorizedMutation(activeClient, "content_cms", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "testimonial",
    resource: { id },
    resourceAction: "delete",
  });

  // Verify Super Admin authority: RLS only allows super_admin to delete testimonials
  const userRole = secCtx.role ? normalizeRole(secCtx.role) : "worker";
  if (userRole !== "super_admin") {
    throw new Error("FORBIDDEN_DELETE: Only super admins can permanently delete client proof.");
  }

  const { error } = await (activeClient as any)
    .from("testimonials")
    .delete()
    .eq("id", id);

  if (error) throw error;

  logSystemAudit({
    action: "TESTIMONIAL_DELETE",
    entityType: "testimonial",
    entityId: id,
    actorId: secCtx.userId,
    actorRole: secCtx.role,
    client: activeClient,
  }).catch(() => {});
}

// Keep legacy aliases for backward compatibility
export const createTestimonialItem = createTestimonial;
export const deleteTestimonialItem = deleteTestimonial;

// ------------------------------------------------------------
// 5. SOCIAL REELS (INSTAGRAM SHOWCASE)
// ------------------------------------------------------------

/**
 * Validates and parses an Instagram Reel or Post URL to extract the shortcode.
 * Supports web URLs, share links, query parameters, and post embeds.
 */
export function parseInstagramReelUrl(url: string): {
  isValid: boolean;
  shortcode: string | null;
  canonicalUrl: string | null;
} {
  if (!url || typeof url !== "string") {
    return { isValid: false, shortcode: null, canonicalUrl: null };
  }

  const cleanUrl = url.trim();
  const match = cleanUrl.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:share\/)?(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i
  );

  if (match && match[1]) {
    const shortcode = match[1];
    return {
      isValid: true,
      shortcode,
      canonicalUrl: `https://www.instagram.com/reel/${shortcode}/`,
    };
  }

  return { isValid: false, shortcode: null, canonicalUrl: null };
}

export async function createSocialReel(
  payload: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "create", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resourceAction: "write",
  });

  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new Error("Title is required for Instagram Reel.");
  }

  if (!payload.instagram_url || !payload.instagram_shortcode) {
    throw new Error("Valid Instagram Reel URL and shortcode are required.");
  }

  if (!payload.thumbnail_url) {
    throw new Error("Thumbnail URL is required for Instagram Reel.");
  }

  const slug =
    payload.slug ||
    payload.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") +
      "-" +
      payload.instagram_shortcode;

  const row = {
    title: payload.title.trim(),
    title_ar: payload.title_ar?.trim() || null,
    caption: payload.caption?.trim() || null,
    description_ar: payload.description_ar?.trim() || null,
    category: payload.category?.trim() || "General",
    instagram_url: payload.instagram_url,
    instagram_shortcode: payload.instagram_shortcode,
    thumbnail_url: payload.thumbnail_url,
    display_order: Number(payload.display_order) || 1,
    is_published: Boolean(payload.is_published),
    is_featured: Boolean(payload.is_featured),
    slug,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (activeClient as any)
    .from("social_reels")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateSocialReel(
  id: string,
  updates: Record<string, any>,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resource: { id },
    resourceAction: "write",
  });

  const payload: Record<string, any> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (payload.title) payload.title = payload.title.trim();
  if (payload.title_ar !== undefined) payload.title_ar = payload.title_ar?.trim() || null;
  if (payload.caption !== undefined) payload.caption = payload.caption?.trim() || null;
  if (payload.description_ar !== undefined) payload.description_ar = payload.description_ar?.trim() || null;
  if (payload.category !== undefined) payload.category = payload.category?.trim() || "General";

  const { data, error } = await (activeClient as any)
    .from("social_reels")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function publishSocialReel(
  id: string,
  isPublished: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resource: { id },
    resourceAction: "write",
  });

  const { data, error } = await (activeClient as any)
    .from("social_reels")
    .update({
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function setFeaturedSocialReel(
  id: string,
  isFeatured: boolean,
  options?: ContentMutationOptions
): Promise<any> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resource: { id },
    resourceAction: "write",
  });

  if (isFeatured) {
    // Proactively reset other reels in case trigger is disabled or delayed
    await (activeClient as any)
      .from("social_reels")
      .update({ is_featured: false, updated_at: new Date().toISOString() })
      .neq("id", id)
      .eq("is_featured", true);
  }

  const { data, error } = await (activeClient as any)
    .from("social_reels")
    .update({
      is_featured: isFeatured,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function reorderSocialReels(
  reelsOrder: { id: string; display_order: number }[],
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "edit", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resourceAction: "write",
  });

  for (const item of reelsOrder) {
    const { error } = await (activeClient as any)
      .from("social_reels")
      .update({ display_order: item.display_order, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) throw error;
  }
}

export async function deleteSocialReel(
  id: string,
  options?: ContentMutationOptions
): Promise<void> {
  const activeClient = options?.clientOverride || options?.client || supabase;
  await assertAuthorizedMutation(activeClient, "content_cms", "delete", {
    ctx: options?.ctx,
    actorRole: options?.actorRole || options?.role,
    actorId: options?.actorId || options?.id,
    resourceType: "social_reel",
    resource: { id },
    resourceAction: "delete",
  });

  const { error } = await (activeClient as any)
    .from("social_reels")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

