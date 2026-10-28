// ============================================================
// SADA OS — SMART PACKAGE MATCHING SYSTEM TYPES
// Canonical definitions for Questionnaire, Recommendation Engine & Leads
// ============================================================

import type { PackageCatalogItem } from "@/types/package-catalog";

/**
 * Three primary entry paths on Contact Us
 */
export type MatcherEntryPath = "smart_match" | "quick_match" | "direct_package";

/**
 * Canonical 11-question Answer Model
 * Every entry path normalizes into this structure.
 */
export interface CanonicalAnswers {
  // Q1 — Business Profile
  businessType: string | null;
  marketScope: string | null;

  // Q2 — Main Goals (Multi-select, at least 1 required)
  primaryGoals: string[];

  // Q3 — Services Needed (Multi-select, strong matching signal)
  requiredServices: string[];

  // Q4 — Content Intensity
  contentIntensity: "light" | "active" | "high_growth" | null;

  // Q5 — Advertising Need
  advertisingNeed: "no" | "occasionally" | "every_month" | "not_sure" | null;

  // Q6 — Website / Digital System
  websiteNeed: "no" | "maybe_later" | "website" | "booking_system" | "not_sure" | null;

  // Q7 — Current Marketing Setup
  currentMarketingSetup: "self" | "team" | "freelancers" | "agency" | "none" | null;

  // Q8 — Business Stage
  businessStage: "starting" | "operating_growth" | "growing_quickly" | "established" | null;

  // Q9 — Monthly Investment / Budget
  budgetRange: "under_700" | "700_1200" | "1200_2000" | "2000_plus" | "not_sure" | null;

  // Q10 — Timeline
  startTimeline: "asap" | "this_month" | "next_month" | "exploring" | null;

  // Q11 — Additional Context (Optional free text)
  additionalContext: string | null;
}

/**
 * Initial empty canonical answers
 */
export const INITIAL_CANONICAL_ANSWERS: CanonicalAnswers = {
  businessType: null,
  marketScope: null,
  primaryGoals: [],
  requiredServices: [],
  contentIntensity: null,
  advertisingNeed: null,
  websiteNeed: null,
  currentMarketingSetup: null,
  businessStage: null,
  budgetRange: null,
  startTimeline: null,
  additionalContext: null,
};

/**
 * Match level evaluation
 */
export type MatchLevel = "strong" | "good" | "moderate" | "custom_fit";

/**
 * Centralized Matching Dimensions Weights Configuration (V2)
 */
export const MATCHING_WEIGHTS = {
  objective: 0.30,        // 30% - Primary Goal / Strategic Objective
  services: 0.25,         // 25% - Requested Services Coverage
  budget: 0.15,           // 15% - Budget Compatibility
  businessType: 0.10,     // 10% - Business Model & Industry Fit
  stage: 0.10,            // 10% - Operational Stage & Maturity
  growthLevel: 0.05,      // 5%  - Growth Intensity & Cadence
  capacity: 0.05,         // 5%  - Delivery Volume & Production Capacity
} as const;

/**
 * Breakdown scores across the 7 V2 matching dimensions (sums to max 100)
 */
export interface RecommendationScoreBreakdown {
  objective: number;      // max 30
  services: number;       // max 25
  budget: number;         // max 15
  businessType: number;   // max 10
  stage: number;          // max 10
  growthLevel: number;    // max 5
  capacity: number;       // max 5
  totalScore: number;     // max 100

  // Legacy field aliases for 100% backward compatibility
  serviceMatch?: number;
  goalMatch?: number;
  contentMatch?: number;
  advertisingMatch?: number;
  websiteMatch?: number;
  budgetMatch?: number;
  businessTypeMatch?: number;
  businessStageMatch?: number;
}

/**
 * Factual reason why a package was selected (never fabricated)
 */
export interface RecommendationReason {
  id: string;
  category: "service" | "content" | "advertising" | "website" | "budget" | "stage" | "general" | "capacity";
  text: string;
  textAr: string;
}

/**
 * Single Package Recommendation Result with V2 Intelligence
 */
export interface PackageRecommendation {
  packageId: string;
  packageCode: string;
  packageName: string;
  packageNameAr?: string | null;
  packagePrice: number;
  currency: string;
  billingType: string;
  score: number;
  matchLevel: MatchLevel;
  breakdown: RecommendationScoreBreakdown;
  reasons: RecommendationReason[];
  gaps?: string[];
  gapsAr?: string[];
  alternativeType?: "budget_friendly" | "expanded_scope" | "also_consider";
  comparisonReason?: string;
  comparisonReasonAr?: string;
  isUnpublished: boolean;
  packageItem: PackageCatalogItem;
}

/**
 * Full recommendation result with best fit, alternatives, and debug metadata
 */
export interface MatchEngineResult {
  bestFit: PackageRecommendation | null;
  alternatives: PackageRecommendation[];
  status: "success" | "no_match" | "unavailable";
  fallbackMessage?: string;
  fallbackMessageAr?: string;
  debugTrace?: {
    evaluatedPackagesCount: number;
    topCandidates: { code: string; name: string; score: number }[];
  };
}

/**
 * Contact Details collected in final step
 */
export interface ContactDetails {
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  city?: string;
  additionalMessage?: string;
}

/**
 * Unified Lead Submission Payload
 */
export interface SmartLeadSubmissionPayload {
  lead: ContactDetails;
  qualification: CanonicalAnswers;
  recommendation: {
    packageId: string | null;
    packageCode?: string | null;
    packageName?: string | null;
    score: number;
    matchLevel: MatchLevel;
    alternativePackageIds: string[];
    reasons: string[];
    isUnpublished?: boolean;
  } | null;
  source: MatcherEntryPath;
}
