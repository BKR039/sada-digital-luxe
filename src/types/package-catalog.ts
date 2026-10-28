// ============================================================
// SADA OS — PACKAGE CATALOG & PRICING SYSTEM TYPES
// Canonical definitions for Categories, Packages, Add-ons and Pricing
// ============================================================

export type BillingType = "monthly" | "one_time" | "starting_from" | "custom";
export type PackageBadge = "most_popular" | "recommended" | "best_value" | "featured" | null;
export type PackageType = "standard" | "hybrid" | "production" | "digital" | "custom";

export interface PackageFeatureItem {
  text: string;
  text_ar?: string;
  icon?: string;
  order?: number;
}

export interface PackageCategory {
  id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  slug: string;
  description?: string | null;
  description_ar?: string | null;
  priority: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PackageApprovalStatus = "approved" | "proposed" | "draft" | "needs_review";
export type CostVerificationStatus = "verified" | "unverified" | "partial" | "needs_review";

export interface PackageCatalogItem {
  id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  slug: string;
  description?: string | null;
  description_ar?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  package_type: PackageType;
  billing_type: BillingType;
  billing_unit?: string;
  price: number;
  proposed_price?: number | null;
  currency: string;
  is_active: boolean;
  is_published: boolean;
  is_internal_only?: boolean;
  approval_status?: PackageApprovalStatus;
  cost_verification_status?: CostVerificationStatus;
  source_page_ref?: string | null;
  operational_notes?: string | null;
  ad_budget_separate?: boolean;
  recommendation_enabled?: boolean;
  is_featured: boolean;
  badge: PackageBadge;
  badge_ar?: string | null;
  priority: number;
  display_order: number;
  short_description?: string | null;
  short_description_ar?: string | null;
  included_items: PackageFeatureItem[];
  excluded_items: PackageFeatureItem[];
  monthly_reels: number;
  monthly_posts: number;
  monthly_stories: string;
  production_hours: number;
  production_sessions: number;
  platforms: string[];
  has_ads_management: boolean;
  has_website: boolean;
  has_strategy: boolean;
  has_community_management: boolean;
  website_scope?: string | null;
  custom_pricing: boolean;

  // Financial OS cost engine parameters
  employee_cost: number;
  freelancer_cost: number;
  transport_cost: number;
  subscription_allocation: number;
  commission: number;
  direct_costs?: number;
  gross_profit?: number;
  gross_margin?: number;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PackageAddon {
  id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  price: number;
  unit: string;
  percentage_modifier?: number | null;
  category?: string | null;
  description?: string | null;
  description_ar?: string | null;
  is_active: boolean;
  display_order: number;
  source_page_ref?: string | null;
  approval_status?: PackageApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface CreatePackageInput {
  code: string;
  name: string;
  name_ar?: string;
  slug?: string;
  description?: string;
  description_ar?: string;
  category_id?: string;
  category_name?: string;
  package_type?: PackageType;
  billing_type?: BillingType;
  billing_unit?: string;
  price: number;
  proposed_price?: number;
  currency?: string;
  is_active?: boolean;
  is_published?: boolean;
  is_internal_only?: boolean;
  approval_status?: PackageApprovalStatus;
  cost_verification_status?: CostVerificationStatus;
  source_page_ref?: string;
  operational_notes?: string;
  ad_budget_separate?: boolean;
  recommendation_enabled?: boolean;
  is_featured?: boolean;
  badge?: PackageBadge;
  badge_ar?: string;
  priority?: number;
  display_order?: number;
  short_description?: string;
  short_description_ar?: string;
  included_items?: PackageFeatureItem[];
  excluded_items?: PackageFeatureItem[];
  monthly_reels?: number;
  monthly_posts?: number;
  monthly_stories?: string;
  production_hours?: number;
  production_sessions?: number;
  platforms?: string[];
  has_ads_management?: boolean;
  has_website?: boolean;
  has_strategy?: boolean;
  has_community_management?: boolean;
  website_scope?: string;
  custom_pricing?: boolean;
  employee_cost?: number;
  freelancer_cost?: number;
  transport_cost?: number;
  subscription_allocation?: number;
  commission?: number;
}

export interface UpdatePackageInput extends Partial<CreatePackageInput> {
  id: string;
}

export interface CreateAddonInput {
  code: string;
  name: string;
  name_ar?: string;
  price: number;
  unit?: string;
  percentage_modifier?: number;
  category?: string;
  description?: string;
  description_ar?: string;
  is_active?: boolean;
  display_order?: number;
  source_page_ref?: string;
  approval_status?: PackageApprovalStatus;
}

export interface UpdateAddonInput extends Partial<CreateAddonInput> {
  id: string;
}

export interface CategoryWithPackages extends PackageCategory {
  packages: PackageCatalogItem[];
}
