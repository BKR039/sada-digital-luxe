// ============================================================
// SADA OS — PRICING CARD SYSTEM TYPES & VISUAL STATE ENGINE
// Canonical visual state resolution, badge logic, and tokens
// ============================================================

import type { PackageCatalogItem, PackageBadge } from "@/types/package-catalog";

export type PackageVisualTier =
  | "standard"
  | "featured"
  | "recommended"
  | "premium"
  | "unavailable";

export interface PackageVisualConfig {
  tier: PackageVisualTier;
  isRecommended: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  isPopular: boolean;
  isUnavailable: boolean;
  accentGlow: boolean;
  badgeType: PackageBadge | "custom_scope" | null;
}

/**
 * Resolves the visual tier and presentation attributes of a package.
 * Single source of truth driven directly by Super Admin package configuration in database:
 * - is_featured (boolean)
 * - badge ('recommended' | 'most_popular' | 'best_value' | 'featured' | null)
 * - package_type ('custom' | 'standard' | 'hybrid' | 'production' | 'digital')
 * - custom_pricing (boolean)
 * - is_active & is_published (boolean)
 */
export function resolvePackageVisualConfig(
  pkg: PackageCatalogItem,
  isPopularOverride?: boolean
): PackageVisualConfig {
  const isUnavailable = !pkg.is_active || !pkg.is_published;

  const isRecommended =
    pkg.badge === "recommended" ||
    (isPopularOverride !== undefined && isPopularOverride && pkg.is_featured);

  const isPopular =
    isPopularOverride ??
    (pkg.badge === "most_popular" || pkg.badge === "recommended");

  const isFeatured = Boolean(pkg.is_featured || pkg.badge === "featured");

  const isPremium =
    pkg.package_type === "custom" ||
    pkg.custom_pricing ||
    pkg.billing_type === "custom" ||
    pkg.price >= 4000;

  // Determine primary visual tier (with intelligent precedence)
  let tier: PackageVisualTier = "standard";
  if (isUnavailable) {
    tier = "unavailable";
  } else if (isRecommended) {
    tier = "recommended";
  } else if (isFeatured) {
    tier = "featured";
  } else if (isPremium) {
    tier = "premium";
  }

  // Determine badge type
  let badgeType: PackageBadge | "custom_scope" | null = pkg.badge;
  if (!badgeType && isFeatured) {
    badgeType = "featured";
  } else if (!badgeType && isPremium && (pkg.custom_pricing || pkg.package_type === "custom")) {
    badgeType = "custom_scope";
  }

  return {
    tier,
    isRecommended,
    isFeatured,
    isPremium,
    isPopular,
    isUnavailable,
    accentGlow: isRecommended || isFeatured,
    badgeType,
  };
}
