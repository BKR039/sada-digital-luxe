// ============================================================
// SADA OS — PHASE 10: CANONICAL PACKAGE CATALOG SERVICE
// Single Source of Truth for Public Pricing, Admin CMS & Client CRM
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { logSystemAudit } from "@/lib/audit-service";
import { canAccessModule } from "@/lib/permissions";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import type {
  PackageCategory,
  PackageCatalogItem,
  PackageAddon,
  CreatePackageInput,
  UpdatePackageInput,
  CreateAddonInput,
  UpdateAddonInput,
  CategoryWithPackages,
  PackageFeatureItem,
} from "@/types/package-catalog";

// Helper for deterministic slug generation
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// 1. PUBLIC PRICING QUERIES
// ============================================================

export const PUBLIC_PACKAGE_SELECT = [
  "id",
  "code",
  "name",
  "name_ar",
  "slug",
  "description",
  "description_ar",
  "category_id",
  "category_name",
  "package_type",
  "billing_type",
  "billing_unit",
  "price",
  "currency",
  "is_active",
  "is_published",
  "is_internal_only",
  "approval_status",
  "recommendation_enabled",
  "is_featured",
  "badge",
  "badge_ar",
  "priority",
  "display_order",
  "short_description",
  "short_description_ar",
  "included_items",
  "excluded_items",
  "monthly_reels",
  "monthly_posts",
  "monthly_stories",
  "production_hours",
  "production_sessions",
  "platforms",
  "has_ads_management",
  "has_website",
  "has_strategy",
  "has_community_management",
  "website_scope",
  "custom_pricing",
  "ad_budget_separate",
  "created_at",
  "updated_at",
].join(", ");

/**
 * Fetches active & published categories and their published packages.
 * Strictly respects:
 * category.is_active = true
 * category.display_order ASC
 * package.is_active = true
 * package.is_published = true
 * package.is_internal_only = false
 * package.approval_status = 'approved'
 * package.display_order ASC
 *
 * Security Invariant: Uses sanitized PUBLIC_PACKAGE_SELECT to strictly exclude
 * internal financial metrics (employee_cost, freelancer_cost, direct_costs, gross_profit, gross_margin, proposed_price, internal notes).
 */
export async function fetchPublicPackages(): Promise<CategoryWithPackages[]> {
  try {
    // 1. Fetch categories
    const { data: categories, error: catError } = await (supabase as any)
      .from("package_categories")
      .select("id, code, name, name_ar, slug, description, description_ar, priority, display_order, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (catError) {
      console.error("[fetchPublicPackages] Categories error:", catError);
      return [];
    }

    // 2. Fetch published active packages with sanitized public projection
    const { data: packages, error: pkgError } = await (supabase as any)
      .from("package_catalog")
      .select(PUBLIC_PACKAGE_SELECT)
      .eq("is_active", true)
      .eq("is_published", true)
      .eq("is_internal_only", false)
      .eq("approval_status", "approved")
      .order("display_order", { ascending: true });

    if (pkgError) {
      console.error("[fetchPublicPackages] Packages error:", pkgError);
      return [];
    }

    // 3. Group packages by category
    const result: CategoryWithPackages[] = (categories || []).map((cat: PackageCategory) => {
      const catPackages = (packages || []).filter(
        (p: PackageCatalogItem) => p.category_id === cat.id
      );
      return {
        ...cat,
        packages: catPackages,
      };
    });

    // Return only categories that have at least 1 package, or all active categories
    return result;
  } catch (err) {
    console.error("[fetchPublicPackages] Unexpected error:", err);
    return [];
  }
}

// ============================================================
// 2. ADMIN CMS CATALOG QUERIES
// ============================================================

export interface PackageCatalogFilter {
  search?: string;
  categoryId?: string;
  status?: "all" | "published" | "draft" | "archived";
  approvalStatus?: "all" | "approved" | "proposed" | "draft" | "needs_review";
  isInternalOnly?: boolean | "all";
  isActive?: boolean;
}

/**
 * Fetches packages for Admin CMS with optional search, category, status, approval, and internal filters.
 */
export async function fetchPackageCatalog(
  filters?: PackageCatalogFilter
): Promise<PackageCatalogItem[]> {
  try {
    let query = (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name, name_ar, slug)")
      .order("display_order", { ascending: true });

    if (filters?.categoryId && filters.categoryId !== "all") {
      query = query.eq("category_id", filters.categoryId);
    }

    if (filters?.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }

    if (filters?.approvalStatus && filters.approvalStatus !== "all") {
      query = query.eq("approval_status", filters.approvalStatus);
    }

    if (filters?.isInternalOnly !== undefined && filters.isInternalOnly !== "all") {
      query = query.eq("is_internal_only", filters.isInternalOnly);
    }

    if (filters?.status === "published") {
      query = query.eq("is_active", true).eq("is_published", true);
    } else if (filters?.status === "draft") {
      query = query.eq("is_active", true).eq("is_published", false);
    } else if (filters?.status === "archived") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[fetchPackageCatalog] Error:", error);
      return [];
    }

    let items: PackageCatalogItem[] = (data || []).map((p: any) => ({
      ...p,
      category_name: p.category?.name || p.category_name,
    }));

    if (filters?.search?.trim()) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.name_ar && p.name_ar.includes(q)) ||
          (p.short_description && p.short_description.toLowerCase().includes(q))
      );
    }

    return items;
  } catch (err) {
    console.error("[fetchPackageCatalog] Unexpected error:", err);
    return [];
  }
}

/**
 * Fetches all package categories.
 */
export async function fetchPackageCategories(): Promise<PackageCategory[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("package_categories")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("[fetchPackageCategories] Error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("[fetchPackageCategories] Unexpected error:", err);
    return [];
  }
}

/**
 * Fetches add-ons.
 */
export async function fetchPackageAddons(activeOnly = true): Promise<PackageAddon[]> {
  try {
    let query = (supabase as any)
      .from("package_addons")
      .select("*")
      .order("display_order", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[fetchPackageAddons] Error:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("[fetchPackageAddons] Unexpected error:", err);
    return [];
  }
}

/**
 * Fetches a single package by its ID.
 */
export async function fetchPackageById(id: string): Promise<PackageCatalogItem | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name, name_ar, slug)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      category_name: data.category?.name || data.category_name,
    };
  } catch (err) {
    console.error("[fetchPackageById] Error:", err);
    return null;
  }
}

/**
 * Fetches a single package by its code (e.g. 'MG-01', 'PR-02').
 */
export async function fetchPackageByCode(code: string): Promise<PackageCatalogItem | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("package_catalog")
      .select("*, category:package_categories(name, name_ar, slug)")
      .ilike("code", code)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      category_name: data.category?.name || data.category_name,
    };
  } catch (err) {
    console.error("[fetchPackageByCode] Error:", err);
    return null;
  }
}

// ============================================================
// 3. ADMIN PACKAGE MUTATIONS (WITH CANONICAL AUDIT)
// ============================================================

export interface ActorInfo {
  id?: string;
  name?: string;
  role?: string;
  client?: any;
  clientOverride?: any;
}

/**
 * Creates a new package in the canonical catalog.
 */
export async function createPackage(
  input: CreatePackageInput,
  actor?: ActorInfo
): Promise<{ success: boolean; package?: PackageCatalogItem; error?: string }> {
  try {
    const activeClient = actor?.clientOverride || actor?.client || supabase;
    await assertAuthorizedMutation(activeClient, "packages", "packages.create", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resourceAction: "write",
    });

    // 1. Validate
    if (!input.code?.trim()) {
      return { success: false, error: "Package code is required (e.g. MG-05)" };
    }
    if (!input.name?.trim()) {
      return { success: false, error: "Package name is required" };
    }
    if (typeof input.price !== "number" || isNaN(input.price) || input.price < 0) {
      return { success: false, error: "Price must be a non-negative number" };
    }

    const cleanCode = input.code.trim().toUpperCase();
    const cleanSlug = input.slug?.trim() || slugify(cleanCode + "-" + input.name);

    const payload: any = {
      code: cleanCode,
      name: input.name.trim(),
      name_ar: input.name_ar?.trim() || null,
      slug: cleanSlug,
      description: input.description?.trim() || null,
      description_ar: input.description_ar?.trim() || null,
      category_id: input.category_id || null,
      category_name: input.category_name || null,
      package_type: input.package_type || "standard",
      billing_type: input.billing_type || "monthly",
      billing_unit: input.billing_unit || "month",
      price: input.price,
      proposed_price: input.proposed_price ?? null,
      currency: input.currency || "TND",
      is_active: input.is_active ?? true,
      is_published: input.is_published ?? false,
      is_internal_only: input.is_internal_only ?? false,
      approval_status: input.approval_status || "approved",
      cost_verification_status: input.cost_verification_status || "unverified",
      source_page_ref: input.source_page_ref || null,
      operational_notes: input.operational_notes || null,
      ad_budget_separate: input.ad_budget_separate ?? true,
      recommendation_enabled: input.recommendation_enabled ?? true,
      is_featured: input.is_featured ?? false,
      badge: input.badge || null,
      badge_ar: input.badge_ar || null,
      priority: input.priority ?? 0,
      display_order: input.display_order ?? 0,
      short_description: input.short_description?.trim() || null,
      short_description_ar: input.short_description_ar?.trim() || null,
      included_items: input.included_items || [],
      excluded_items: input.excluded_items || [],
      monthly_reels: input.monthly_reels ?? 0,
      monthly_posts: input.monthly_posts ?? 0,
      monthly_stories: input.monthly_stories || "",
      production_hours: input.production_hours ?? 0,
      production_sessions: input.production_sessions ?? 0,
      platforms: input.platforms || ["instagram", "facebook"],
      has_ads_management: input.has_ads_management ?? false,
      has_website: input.has_website ?? false,
      has_strategy: input.has_strategy ?? false,
      has_community_management: input.has_community_management ?? false,
      website_scope: input.website_scope || null,
      custom_pricing: input.custom_pricing ?? (input.billing_type === "custom"),
      employee_cost: input.employee_cost ?? 0,
      freelancer_cost: input.freelancer_cost ?? 0,
      transport_cost: input.transport_cost ?? 0,
      subscription_allocation: input.subscription_allocation ?? 0,
      commission: input.commission ?? 0,
      created_by: actor?.id || null,
      updated_by: actor?.id || null,
    };

    const { data, error } = await (activeClient as any)
      .from("package_catalog")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // 2. Log canonical audit
    await logSystemAudit({
      action: "PACKAGE_CREATED",
      entityType: "package_catalog",
      entityId: data.id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { code: data.code, name: data.name, price: data.price },
    });

    return { success: true, package: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create package" };
  }
}

/**
 * Updates an existing package in the canonical catalog.
 */
export async function updatePackage(
  input: UpdatePackageInput,
  actor?: ActorInfo
): Promise<{ success: boolean; package?: PackageCatalogItem; error?: string }> {
  try {
    if (!input.id) {
      return { success: false, error: "Package ID is required" };
    }

    // 1. Fetch current values for audit comparison
    const existing = await fetchPackageById(input.id);
    if (!existing) {
      return { success: false, error: "Package not found" };
    }

    await assertAuthorizedMutation(supabase, "packages", "packages.edit", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resource: existing,
      resourceAction: "write",
    });

    const payload: any = {
      updated_at: new Date().toISOString(),
      updated_by: actor?.id || null,
    };

    if (input.code !== undefined) payload.code = input.code.trim().toUpperCase();
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.name_ar !== undefined) payload.name_ar = input.name_ar?.trim() || null;
    if (input.slug !== undefined) payload.slug = input.slug.trim();
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.description_ar !== undefined) payload.description_ar = input.description_ar?.trim() || null;
    if (input.category_id !== undefined) payload.category_id = input.category_id || null;
    if (input.category_name !== undefined) payload.category_name = input.category_name || null;
    if (input.package_type !== undefined) payload.package_type = input.package_type;
    if (input.billing_type !== undefined) payload.billing_type = input.billing_type;
    if (input.billing_unit !== undefined) payload.billing_unit = input.billing_unit;
    if (input.price !== undefined) {
      if (typeof input.price !== "number" || isNaN(input.price) || input.price < 0) {
        return { success: false, error: "Price must be a non-negative number" };
      }
      payload.price = input.price;
    }
    if (input.proposed_price !== undefined) payload.proposed_price = input.proposed_price;
    if (input.currency !== undefined) payload.currency = input.currency;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    if (input.is_published !== undefined) payload.is_published = input.is_published;
    if (input.is_internal_only !== undefined) payload.is_internal_only = input.is_internal_only;
    if (input.approval_status !== undefined) payload.approval_status = input.approval_status;
    if (input.cost_verification_status !== undefined) payload.cost_verification_status = input.cost_verification_status;
    if (input.source_page_ref !== undefined) payload.source_page_ref = input.source_page_ref;
    if (input.operational_notes !== undefined) payload.operational_notes = input.operational_notes;
    if (input.ad_budget_separate !== undefined) payload.ad_budget_separate = input.ad_budget_separate;
    if (input.recommendation_enabled !== undefined) payload.recommendation_enabled = input.recommendation_enabled;
    if (input.is_featured !== undefined) payload.is_featured = input.is_featured;
    if (input.badge !== undefined) payload.badge = input.badge || null;
    if (input.badge_ar !== undefined) payload.badge_ar = input.badge_ar || null;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.display_order !== undefined) payload.display_order = input.display_order;
    if (input.short_description !== undefined) payload.short_description = input.short_description?.trim() || null;
    if (input.short_description_ar !== undefined) payload.short_description_ar = input.short_description_ar?.trim() || null;
    if (input.included_items !== undefined) payload.included_items = input.included_items;
    if (input.excluded_items !== undefined) payload.excluded_items = input.excluded_items;
    if (input.monthly_reels !== undefined) payload.monthly_reels = input.monthly_reels;
    if (input.monthly_posts !== undefined) payload.monthly_posts = input.monthly_posts;
    if (input.monthly_stories !== undefined) payload.monthly_stories = input.monthly_stories;
    if (input.production_hours !== undefined) payload.production_hours = input.production_hours;
    if (input.production_sessions !== undefined) payload.production_sessions = input.production_sessions;
    if (input.platforms !== undefined) payload.platforms = input.platforms;
    if (input.has_ads_management !== undefined) payload.has_ads_management = input.has_ads_management;
    if (input.has_website !== undefined) payload.has_website = input.has_website;
    if (input.has_strategy !== undefined) payload.has_strategy = input.has_strategy;
    if (input.has_community_management !== undefined) payload.has_community_management = input.has_community_management;
    if (input.website_scope !== undefined) payload.website_scope = input.website_scope;
    if (input.custom_pricing !== undefined) payload.custom_pricing = input.custom_pricing;
    if (input.employee_cost !== undefined) payload.employee_cost = input.employee_cost;
    if (input.freelancer_cost !== undefined) payload.freelancer_cost = input.freelancer_cost;
    if (input.transport_cost !== undefined) payload.transport_cost = input.transport_cost;
    if (input.subscription_allocation !== undefined) payload.subscription_allocation = input.subscription_allocation;
    if (input.commission !== undefined) payload.commission = input.commission;

    const { data, error } = await (supabase as any)
      .from("package_catalog")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // 2. Audit logging
    await logSystemAudit({
      action: "PACKAGE_UPDATED",
      entityType: "package_catalog",
      entityId: input.id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      oldValues: { code: existing.code, name: existing.name, price: existing.price },
      newValues: payload,
    });

    if (input.price !== undefined && input.price !== existing.price) {
      await logSystemAudit({
        action: "PACKAGE_PRICE_CHANGED",
        entityType: "package_catalog",
        entityId: input.id,
        actorId: actor?.id,
        actorName: actor?.name,
        actorRole: actor?.role || "super_admin",
        oldValues: { price: existing.price },
        newValues: { price: input.price },
      });
    }

    if (input.included_items !== undefined || input.excluded_items !== undefined) {
      await logSystemAudit({
        action: "PACKAGE_FEATURE_CHANGED",
        entityType: "package_catalog",
        entityId: input.id,
        actorId: actor?.id,
        actorName: actor?.name,
        actorRole: actor?.role || "super_admin",
        oldValues: { included_count: existing.included_items?.length, excluded_count: existing.excluded_items?.length },
        newValues: { included_count: input.included_items?.length, excluded_count: input.excluded_items?.length },
      });
    }

    return { success: true, package: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update package" };
  }
}

/**
 * Publishes a package immediately so it becomes visible on the public Pricing page.
 */
export async function publishPackage(id: string, actor?: ActorInfo): Promise<boolean> {
  try {
    const activeClient = actor?.clientOverride || actor?.client || supabase;
    await assertAuthorizedMutation(activeClient, "packages", "packages.publish", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resource: { id },
      resourceAction: "write",
    });

    const { error } = await (activeClient as any)
      .from("package_catalog")
      .update({ is_published: true, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    await logSystemAudit({
      action: "PACKAGE_PUBLISHED",
      entityType: "package_catalog",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { is_published: true },
    });
    return true;
  } catch (err) {
    console.error("[publishPackage] Error:", err);
    return false;
  }
}

/**
 * Hides a package from the public Pricing page without archiving it.
 */
export async function hidePackage(id: string, actor?: ActorInfo): Promise<boolean> {
  try {
    const activeClient = actor?.clientOverride || actor?.client || supabase;
    await assertAuthorizedMutation(activeClient, "packages", "packages.hide", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resource: { id },
      resourceAction: "write",
    });

    const { error } = await (activeClient as any)
      .from("package_catalog")
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    await logSystemAudit({
      action: "PACKAGE_HIDDEN",
      entityType: "package_catalog",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { is_published: false },
    });
    return true;
  } catch (err) {
    console.error("[hidePackage] Error:", err);
    return false;
  }
}

/**
 * Archives a package (soft delete) so it is unavailable for new clients,
 * while preserving historical contracts and invoices.
 */
export async function archivePackage(id: string, actor?: ActorInfo): Promise<boolean> {
  try {
    const activeClient = actor?.clientOverride || actor?.client || supabase;
    await assertAuthorizedMutation(activeClient, "packages", "packages.edit", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resource: { id },
      resourceAction: "write",
    });

    const { error } = await (activeClient as any)
      .from("package_catalog")
      .update({ is_active: false, is_published: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    await logSystemAudit({
      action: "PACKAGE_ARCHIVED",
      entityType: "package_catalog",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { is_active: false, is_published: false },
    });
    return true;
  } catch (err) {
    console.error("[archivePackage] Error:", err);
    return false;
  }
}

/**
 * Attempts a physical DELETE on package_catalog.
 * Database trigger `prevent_referenced_package_deletion()` strictly BLOCKS
 * deletion if any client, deal, deliverable, or booking references it.
 */
export async function deletePackage(
  id: string,
  actor?: ActorInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    const activeClient = actor?.clientOverride || actor?.client || supabase;
    await assertAuthorizedMutation(activeClient, "packages", "packages.delete", {
      actorRole: actor?.role,
      actorId: actor?.id,
      resourceType: "package_item",
      resource: { id },
      resourceAction: "delete",
    });

    const { error } = await (activeClient as any)
      .from("package_catalog")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    await logSystemAudit({
      action: "PACKAGE_DELETED",
      entityType: "package_catalog",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { deleted_id: id },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete package" };
  }
}

/**
 * Duplicates a package as an unpublished draft with a new unique code.
 */
export async function duplicatePackage(
  id: string,
  newCode: string,
  actor?: ActorInfo
): Promise<{ success: boolean; package?: PackageCatalogItem; error?: string }> {
  try {
    if (!newCode?.trim()) {
      return { success: false, error: "A unique new package code is required" };
    }

    const source = await fetchPackageById(id);
    if (!source) {
      return { success: false, error: "Source package not found" };
    }

    const cleanCode = newCode.trim().toUpperCase();
    return await createPackage(
      {
        code: cleanCode,
        name: `${source.name} (Copy)`,
        name_ar: source.name_ar ? `${source.name_ar} (نسخة)` : undefined,
        slug: slugify(`${cleanCode}-${source.name}-copy`),
        description: source.description || undefined,
        description_ar: source.description_ar || undefined,
        category_id: source.category_id || undefined,
        category_name: source.category_name || undefined,
        package_type: source.package_type,
        billing_type: source.billing_type,
        billing_unit: source.billing_unit || "month",
        price: source.price,
        proposed_price: source.proposed_price ?? undefined,
        currency: source.currency,
        is_active: true,
        is_published: false, // Always starts as Draft
        is_internal_only: source.is_internal_only ?? false,
        approval_status: source.approval_status || "draft",
        cost_verification_status: source.cost_verification_status || "unverified",
        source_page_ref: source.source_page_ref || undefined,
        operational_notes: source.operational_notes || undefined,
        ad_budget_separate: source.ad_budget_separate ?? true,
        recommendation_enabled: source.recommendation_enabled ?? true,
        is_featured: false,
        badge: null,
        priority: source.priority,
        display_order: source.display_order + 1,
        short_description: source.short_description || undefined,
        short_description_ar: source.short_description_ar || undefined,
        included_items: source.included_items,
        excluded_items: source.excluded_items,
        monthly_reels: source.monthly_reels,
        monthly_posts: source.monthly_posts,
        monthly_stories: source.monthly_stories,
        production_hours: source.production_hours,
        production_sessions: source.production_sessions,
        platforms: source.platforms,
        has_ads_management: source.has_ads_management,
        has_website: source.has_website,
        has_strategy: source.has_strategy,
        has_community_management: source.has_community_management,
        website_scope: source.website_scope || undefined,
        custom_pricing: source.custom_pricing,
        employee_cost: source.employee_cost,
        freelancer_cost: source.freelancer_cost,
        transport_cost: source.transport_cost,
        subscription_allocation: source.subscription_allocation,
        commission: source.commission,
      },
      actor
    );
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to duplicate package" };
  }
}

/**
 * Reorders packages by updating display_order or priority in batch.
 */
export async function reorderPackages(
  items: { id: string; display_order: number; priority?: number }[],
  actor?: ActorInfo
): Promise<boolean> {
  try {
    for (const item of items) {
      await (supabase as any)
        .from("package_catalog")
        .update({
          display_order: item.display_order,
          priority: item.priority ?? item.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }

    await logSystemAudit({
      action: "PACKAGE_REORDERED",
      entityType: "package_catalog",
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { count: items.length },
    });

    return true;
  } catch (err) {
    console.error("[reorderPackages] Error:", err);
    return false;
  }
}

// ============================================================
// 4. ADD-ONS MUTATIONS
// ============================================================

export async function createAddon(
  input: CreateAddonInput,
  actor?: ActorInfo
): Promise<{ success: boolean; addon?: PackageAddon; error?: string }> {
  try {
    if (!input.name?.trim()) return { success: false, error: "Name is required" };
    if (!input.code?.trim()) return { success: false, error: "Code is required" };

    const payload: any = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      name_ar: input.name_ar?.trim() || null,
      price: input.price ?? 0,
      unit: input.unit || "item",
      percentage_modifier: input.percentage_modifier ?? null,
      category: input.category || "general",
      description: input.description?.trim() || null,
      description_ar: input.description_ar?.trim() || null,
      is_active: input.is_active ?? true,
      display_order: input.display_order ?? 0,
      source_page_ref: input.source_page_ref || null,
      approval_status: input.approval_status || "approved",
    };

    const { data, error } = await (supabase as any)
      .from("package_addons")
      .insert(payload)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };

    await logSystemAudit({
      action: "ADDON_CREATED",
      entityType: "package_addons",
      entityId: data.id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { code: data.code, name: data.name, price: data.price },
    });

    return { success: true, addon: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create add-on" };
  }
}

export async function updateAddon(
  input: UpdateAddonInput,
  actor?: ActorInfo
): Promise<{ success: boolean; addon?: PackageAddon; error?: string }> {
  try {
    const payload: any = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.name_ar !== undefined) payload.name_ar = input.name_ar?.trim() || null;
    if (input.price !== undefined) payload.price = input.price;
    if (input.unit !== undefined) payload.unit = input.unit;
    if (input.percentage_modifier !== undefined) payload.percentage_modifier = input.percentage_modifier;
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.description_ar !== undefined) payload.description_ar = input.description_ar?.trim() || null;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    if (input.display_order !== undefined) payload.display_order = input.display_order;
    if (input.source_page_ref !== undefined) payload.source_page_ref = input.source_page_ref;
    if (input.approval_status !== undefined) payload.approval_status = input.approval_status;

    const { data, error } = await (supabase as any)
      .from("package_addons")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };

    await logSystemAudit({
      action: "ADDON_UPDATED",
      entityType: "package_addons",
      entityId: input.id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: payload,
    });

    return { success: true, addon: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update add-on" };
  }
}

export async function archiveAddon(id: string, actor?: ActorInfo): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from("package_addons")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    await logSystemAudit({
      action: "ADDON_ARCHIVED",
      entityType: "package_addons",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: { is_active: false },
    });

    return true;
  } catch (err) {
    console.error("[archiveAddon] Error:", err);
    return false;
  }
}

// ============================================================
// 5. CATEGORIES MUTATIONS
// ============================================================

export async function updateCategory(
  id: string,
  input: Partial<PackageCategory>,
  actor?: ActorInfo
): Promise<boolean> {
  try {
    const payload: any = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.name_ar !== undefined) payload.name_ar = input.name_ar?.trim() || null;
    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.description_ar !== undefined) payload.description_ar = input.description_ar?.trim() || null;
    if (input.display_order !== undefined) payload.display_order = input.display_order;
    if (input.priority !== undefined) payload.priority = input.priority;
    if (input.is_active !== undefined) payload.is_active = input.is_active;

    const { error } = await (supabase as any)
      .from("package_categories")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    await logSystemAudit({
      action: "CATEGORY_UPDATED",
      entityType: "package_categories",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorRole: actor?.role || "super_admin",
      newValues: payload,
    });

    return true;
  } catch (err) {
    console.error("[updateCategory] Error:", err);
    return false;
  }
}
