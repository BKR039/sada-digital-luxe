// ============================================================
// SADA OS — ADMIN PACKAGE EDITOR DRAWER (REENGINEERED UX)
// High-Hierarchy Multi-Section Form + Live Public Preview
// ============================================================

import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Check,
  X,
  Plus,
  Eye,
  Settings2,
  DollarSign,
  Layers,
  ListChecks,
  Ban,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  HelpCircle,
  Film,
  FileText,
  Flame,
  Camera,
  Target,
  Globe,
  Compass,
  Info,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  SADADrawer,
  SADAButton,
  SADAInput,
  SADATextarea,
  SADASelect,
  SADASwitch,
  SADANumberStepper,
  SADABadge,
} from "@/components/ui/sada-ui";
import type {
  PackageCatalogItem,
  PackageCategory,
  CreatePackageInput,
  PackageFeatureItem,
  BillingType,
  PackageBadge,
  PackageType,
  PackageApprovalStatus,
  CostVerificationStatus,
} from "@/types/package-catalog";
import { slugify } from "@/lib/package-service";
import {
  formatPackageNumber,
  formatPackagePrice,
  formatGrossMargin,
  OFFICIAL_FEATURE_LIBRARY,
  OFFICIAL_EXCLUSIONS_LIBRARY,
  TARGET_BUSINESS_TYPES,
  TARGET_STRATEGIC_GOALS,
  GROWTH_STAGES,
} from "@/components/packages/package-utils";
import { PublicPackageCard } from "@/components/packages/PublicPackageCard";

export interface PackageEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: PackageCatalogItem | null;
  categories: PackageCategory[];
  onSave: (pkgData: CreatePackageInput) => Promise<boolean>;
  saving: boolean;
  isAr?: boolean;
  initialSection?: SectionTab;
  initialEditorMode?: "config" | "preview";
}

type SectionTab =
  | "identity"
  | "pricing"
  | "deliverables"
  | "services"
  | "exclusions"
  | "operations"
  | "matching";

export function PackageEditorDrawer({
  open,
  onOpenChange,
  mode,
  initialData,
  categories,
  onSave,
  saving,
  isAr = false,
  initialSection = "pricing",
  initialEditorMode = "config",
}: PackageEditorDrawerProps) {
  // Top-level mode: Configuration vs Public Preview
  const [editorMode, setEditorMode] = useState<"config" | "preview">(initialEditorMode);

  // Section navigation inside configuration mode
  const [activeSection, setActiveSection] = useState<SectionTab>(initialSection);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // ----------------------------------------------------
  // FORM STATE
  // ----------------------------------------------------
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPackageType, setFormPackageType] = useState<PackageType>("standard");
  const [formBillingType, setFormBillingType] = useState<BillingType>("monthly");
  const [formBillingUnit, setFormBillingUnit] = useState<string>("month");
  const [formPrice, setFormPrice] = useState<number>(1000);
  const [formProposedPrice, setFormProposedPrice] = useState<number | null>(null);
  const [formCurrency, setFormCurrency] = useState("TND");
  const [formCustomPricing, setFormCustomPricing] = useState(false);

  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsInternalOnly, setFormIsInternalOnly] = useState<boolean>(true);
  const [formApprovalStatus, setFormApprovalStatus] = useState<PackageApprovalStatus>("approved");
  const [formCostVerificationStatus, setFormCostVerificationStatus] = useState<CostVerificationStatus>("unverified");
  const [formSourcePageRef, setFormSourcePageRef] = useState<string>("");
  const [formOperationalNotes, setFormOperationalNotes] = useState<string>("");
  const [formAdBudgetSeparate, setFormAdBudgetSeparate] = useState<boolean>(true);
  const [formRecommendationEnabled, setFormRecommendationEnabled] = useState<boolean>(true);

  const [formBadge, setFormBadge] = useState<PackageBadge>(null);
  const [formBadgeAr, setFormBadgeAr] = useState("");
  const [formPriority, setFormPriority] = useState<number>(0);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);

  const [formShortDesc, setFormShortDesc] = useState("");
  const [formShortDescAr, setFormShortDescAr] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDescAr, setFormDescAr] = useState("");

  // Deliverable quotas
  const [formMonthlyReels, setFormMonthlyReels] = useState<number>(0);
  const [formMonthlyPosts, setFormMonthlyPosts] = useState<number>(0);
  const [formMonthlyStories, setFormMonthlyStories] = useState("");
  const [formProductionHours, setFormProductionHours] = useState<number>(0);
  const [formProductionSessions, setFormProductionSessions] = useState<number>(0);
  const [formPlatforms, setFormPlatforms] = useState<string[]>(["instagram", "facebook"]);

  // Operational Flags
  const [formHasAds, setFormHasAds] = useState(false);
  const [formHasWeb, setFormHasWeb] = useState(false);
  const [formHasStrategy, setFormHasStrategy] = useState(false);
  const [formHasCommunity, setFormHasCommunity] = useState(false);
  const [formWebScope, setFormWebScope] = useState("");

  // Cost Engine State
  const [formEmployeeCost, setFormEmployeeCost] = useState<number>(0);
  const [formFreelancerCost, setFormFreelancerCost] = useState<number>(0);
  const [formTransportCost, setFormTransportCost] = useState<number>(0);
  const [formSubAlloc, setFormSubAlloc] = useState<number>(0);
  const [formCommission, setFormCommission] = useState<number>(0);

  // Dynamic Inclusions & Exclusions
  const [formIncludedItems, setFormIncludedItems] = useState<PackageFeatureItem[]>([]);
  const [formExcludedItems, setFormExcludedItems] = useState<PackageFeatureItem[]>([]);

  // New item inputs
  const [newFeatureText, setNewFeatureText] = useState("");
  const [newFeatureTextAr, setNewFeatureTextAr] = useState("");
  const [newExclusionText, setNewExclusionText] = useState("");
  const [newExclusionTextAr, setNewExclusionTextAr] = useState("");

  // Matching Profile State
  const [matchingBusinessTypes, setMatchingBusinessTypes] = useState<string[]>([]);
  const [matchingGoals, setMatchingGoals] = useState<string[]>([]);
  const [matchingStage, setMatchingStage] = useState<string>("scaling");
  const [matchingBudgetMin, setMatchingBudgetMin] = useState<number>(1000);
  const [matchingBudgetMax, setMatchingBudgetMax] = useState<number>(3000);
  const [matchingPositioning, setMatchingPositioning] = useState("");

  // Populate form on open or initialData change
  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormCode(initialData.code || "");
      setFormName(initialData.name || "");
      setFormNameAr(initialData.name_ar || "");
      setFormSlug(initialData.slug || "");
      setFormCategoryId(initialData.category_id || "");
      setFormPackageType(initialData.package_type || "standard");
      setFormBillingType(initialData.billing_type || "monthly");
      setFormBillingUnit(initialData.billing_unit || (initialData.billing_type === "monthly" ? "month" : "service"));
      setFormPrice(initialData.price ?? 1000);
      setFormProposedPrice(initialData.proposed_price ?? null);
      setFormCurrency(initialData.currency || "TND");
      setFormCustomPricing(initialData.custom_pricing || false);

      setFormIsActive(initialData.is_active ?? true);
      setFormIsPublished(initialData.is_published ?? true);
      setFormIsFeatured(initialData.is_featured ?? false);
      setFormIsInternalOnly(initialData.is_internal_only ?? false);
      setFormApprovalStatus(initialData.approval_status || "approved");
      setFormCostVerificationStatus(initialData.cost_verification_status || "unverified");
      setFormSourcePageRef(initialData.source_page_ref || "");
      setFormOperationalNotes(initialData.operational_notes || "");
      setFormAdBudgetSeparate(initialData.ad_budget_separate ?? true);
      setFormRecommendationEnabled(initialData.recommendation_enabled ?? true);

      setFormBadge(initialData.badge || null);
      setFormBadgeAr(initialData.badge_ar || "");
      setFormPriority(initialData.priority ?? 0);
      setFormDisplayOrder(initialData.display_order ?? 0);

      setFormShortDesc(initialData.short_description || "");
      setFormShortDescAr(initialData.short_description_ar || "");
      setFormDesc(initialData.description || "");
      setFormDescAr(initialData.description_ar || "");

      setFormMonthlyReels(initialData.monthly_reels ?? 0);
      setFormMonthlyPosts(initialData.monthly_posts ?? 0);
      setFormMonthlyStories(initialData.monthly_stories || "");
      setFormProductionHours(initialData.production_hours ?? 0);
      setFormProductionSessions(initialData.production_sessions ?? 0);
      setFormPlatforms(initialData.platforms || ["instagram", "facebook"]);

      setFormHasAds(initialData.has_ads_management ?? false);
      setFormHasWeb(initialData.has_website ?? false);
      setFormHasStrategy(initialData.has_strategy ?? false);
      setFormHasCommunity(initialData.has_community_management ?? false);
      setFormWebScope(initialData.website_scope || "");

      setFormEmployeeCost(initialData.employee_cost ?? 0);
      setFormFreelancerCost(initialData.freelancer_cost ?? 0);
      setFormTransportCost(initialData.transport_cost ?? 0);
      setFormSubAlloc(initialData.subscription_allocation ?? 0);
      setFormCommission(initialData.commission ?? 0);

      setFormIncludedItems(initialData.included_items || []);
      setFormExcludedItems(initialData.excluded_items || []);

      // Auto-extract matching hints if present
      const pkgPrice = initialData.price || 1000;
      setMatchingBudgetMin(Math.max(500, Math.round(pkgPrice * 0.75)));
      setMatchingBudgetMax(Math.round(pkgPrice * 1.5));
    } else {
      // Defaults for create mode
      setFormCode("");
      setFormName("");
      setFormNameAr("");
      setFormSlug("");
      setFormCategoryId(categories[0]?.id || "");
      setFormPackageType("standard");
      setFormBillingType("monthly");
      setFormBillingUnit("month");
      setFormPrice(1090);
      setFormProposedPrice(null);
      setFormCurrency("TND");
      setFormCustomPricing(false);

      setFormIsActive(true);
      setFormIsPublished(true);
      setFormIsFeatured(false);
      setFormIsInternalOnly(true);
      setFormApprovalStatus("approved");
      setFormCostVerificationStatus("unverified");
      setFormSourcePageRef("");
      setFormOperationalNotes("");
      setFormAdBudgetSeparate(true);
      setFormRecommendationEnabled(true);

      setFormBadge(null);
      setFormBadgeAr("");
      setFormPriority(0);
      setFormDisplayOrder(categories.length > 0 ? 10 : 0);

      setFormShortDesc("");
      setFormShortDescAr("");
      setFormDesc("");
      setFormDescAr("");

      setFormMonthlyReels(8);
      setFormMonthlyPosts(8);
      setFormMonthlyStories("Weekly Stories");
      setFormProductionHours(0);
      setFormProductionSessions(0);
      setFormPlatforms(["instagram", "facebook"]);

      setFormHasAds(false);
      setFormHasWeb(false);
      setFormHasStrategy(true);
      setFormHasCommunity(true);
      setFormWebScope("");

      setFormEmployeeCost(0);
      setFormFreelancerCost(0);
      setFormTransportCost(0);
      setFormSubAlloc(0);
      setFormCommission(0);

      setFormIncludedItems([
        { text: "8 Reels / month", text_ar: "8 ريلز شهرياً", order: 1 },
        { text: "8 Posts / Carousels", text_ar: "8 منشورات أو كاروسيل", order: 2 },
        { text: "Weekly Stories", text_ar: "ستوريز أسبوعية منتظمة", order: 3 },
        { text: "Content Planning", text_ar: "تخطيط وجدولة المحتوى", order: 4 },
        { text: "Copywriting", text_ar: "كتابة النصوص التسويقية", order: 5 },
        { text: "Community Management", text_ar: "إدارة المجتمع والتفاعل", order: 6 },
        { text: "Monthly Analytics Report", text_ar: "تقرير أداء شهري تفصيلي", order: 7 },
      ]);
      setFormExcludedItems([
        { text: "Photography / Videography", text_ar: "التصوير الفوتوغرافي والفيديو", order: 1 },
        { text: "Sponsoring / Ad Budget", text_ar: "ميزانية الإعلانات الممولة", order: 2 },
      ]);

      setMatchingBusinessTypes(["restaurant_cafe", "retail"]);
      setMatchingGoals(["social_growth", "brand_authority"]);
      setMatchingStage("scaling");
      setMatchingBudgetMin(900);
      setMatchingBudgetMax(2000);
      setMatchingPositioning("Balanced monthly organic growth package for retail and hospitality brands.");
    }
    setActiveSection(initialSection || "identity");
    setEditorMode(initialEditorMode || "config");
  }, [initialData, mode, open, categories, initialSection, initialEditorMode]);

  // Automated Financial Formulas
  const totalDirectCosts = useMemo(() => {
    return (
      (Number(formEmployeeCost) || 0) +
      (Number(formFreelancerCost) || 0) +
      (Number(formTransportCost) || 0) +
      (Number(formSubAlloc) || 0) +
      (Number(formCommission) || 0)
    );
  }, [formEmployeeCost, formFreelancerCost, formTransportCost, formSubAlloc, formCommission]);

  const calculatedGrossProfit = useMemo(() => {
    return (Number(formPrice) || 0) - totalDirectCosts;
  }, [formPrice, totalDirectCosts]);

  const calculatedMargin = useMemo(() => {
    const price = Number(formPrice) || 0;
    if (price <= 0) return 0;
    return (calculatedGrossProfit / price) * 100;
  }, [formPrice, calculatedGrossProfit]);

  // Selected Category Name
  const selectedCategoryName = useMemo(() => {
    return categories.find((c) => c.id === formCategoryId)?.name || "Standard";
  }, [categories, formCategoryId]);

  // Live Synthetic Package Item for Live Preview
  const livePreviewPackage: PackageCatalogItem = useMemo(() => {
    return {
      id: initialData?.id || "preview-pkg",
      code: formCode || "MG-XX",
      name: formName || "Package Title",
      name_ar: formNameAr || undefined,
      slug: formSlug || "package-slug",
      category_id: formCategoryId,
      category_name: selectedCategoryName,
      package_type: formPackageType,
      billing_type: formBillingType,
      billing_unit: formBillingUnit,
      price: formPrice,
      proposed_price: formProposedPrice !== null ? formProposedPrice : undefined,
      currency: formCurrency,
      is_active: formIsActive,
      is_published: formIsPublished,
      is_featured: formIsFeatured,
      is_internal_only: formIsInternalOnly,
      approval_status: formApprovalStatus,
      cost_verification_status: formCostVerificationStatus,
      source_page_ref: formSourcePageRef || undefined,
      operational_notes: formOperationalNotes || undefined,
      ad_budget_separate: formAdBudgetSeparate,
      recommendation_enabled: formRecommendationEnabled,
      badge: formBadge,
      badge_ar: formBadgeAr,
      priority: formPriority,
      display_order: formDisplayOrder,
      short_description: formShortDesc || "Standardized marketing package outcomes and target profile.",
      short_description_ar: formShortDescAr || undefined,
      description: formDesc,
      description_ar: formDescAr,
      included_items: formIncludedItems,
      excluded_items: formExcludedItems,
      monthly_reels: formMonthlyReels,
      monthly_posts: formMonthlyPosts,
      monthly_stories: formMonthlyStories,
      production_hours: formProductionHours,
      production_sessions: formProductionSessions,
      platforms: formPlatforms,
      has_ads_management: formHasAds,
      has_website: formHasWeb,
      has_strategy: formHasStrategy,
      has_community_management: formHasCommunity,
      website_scope: formWebScope,
      custom_pricing: formCustomPricing,
      employee_cost: formEmployeeCost,
      freelancer_cost: formFreelancerCost,
      transport_cost: formTransportCost,
      subscription_allocation: formSubAlloc,
      commission: formCommission,
      direct_costs: totalDirectCosts,
      gross_profit: calculatedGrossProfit,
      gross_margin: calculatedMargin,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [
    initialData,
    formCode,
    formName,
    formNameAr,
    formSlug,
    formCategoryId,
    selectedCategoryName,
    formPackageType,
    formBillingType,
    formBillingUnit,
    formPrice,
    formProposedPrice,
    formCurrency,
    formIsActive,
    formIsPublished,
    formIsFeatured,
    formIsInternalOnly,
    formApprovalStatus,
    formCostVerificationStatus,
    formSourcePageRef,
    formOperationalNotes,
    formAdBudgetSeparate,
    formRecommendationEnabled,
    formBadge,
    formBadgeAr,
    formPriority,
    formDisplayOrder,
    formShortDesc,
    formShortDescAr,
    formDesc,
    formDescAr,
    formIncludedItems,
    formExcludedItems,
    formMonthlyReels,
    formMonthlyPosts,
    formMonthlyStories,
    formProductionHours,
    formProductionSessions,
    formPlatforms,
    formHasAds,
    formHasWeb,
    formHasStrategy,
    formHasCommunity,
    formWebScope,
    formCustomPricing,
    formEmployeeCost,
    formFreelancerCost,
    formTransportCost,
    formSubAlloc,
    formCommission,
    totalDirectCosts,
    calculatedGrossProfit,
    calculatedMargin,
  ]);

  // Feature Add / Remove handlers
  const handleAddIncludedFeature = () => {
    if (!newFeatureText.trim()) return;
    const newItem: PackageFeatureItem = {
      text: newFeatureText.trim(),
      text_ar: newFeatureTextAr.trim() || undefined,
      order: formIncludedItems.length + 1,
    };
    setFormIncludedItems((prev) => [...prev, newItem]);
    setNewFeatureText("");
    setNewFeatureTextAr("");
  };

  const handleAddExcludedFeature = () => {
    if (!newExclusionText.trim()) return;
    const newItem: PackageFeatureItem = {
      text: newExclusionText.trim(),
      text_ar: newExclusionTextAr.trim() || undefined,
      order: formExcludedItems.length + 1,
    };
    setFormExcludedItems((prev) => [...prev, newItem]);
    setNewExclusionText("");
    setNewExclusionTextAr("");
  };

  const handleInsertLibraryFeature = (enText: string, arText: string) => {
    if (formIncludedItems.some((i) => i.text.toLowerCase() === enText.toLowerCase())) return;
    setFormIncludedItems((prev) => [
      ...prev,
      { text: enText, text_ar: arText, order: prev.length + 1 },
    ]);
  };

  const handleInsertLibraryExclusion = (enText: string, arText: string) => {
    if (formExcludedItems.some((i) => i.text.toLowerCase() === enText.toLowerCase())) return;
    setFormExcludedItems((prev) => [
      ...prev,
      { text: enText, text_ar: arText, order: prev.length + 1 },
    ]);
  };

  const togglePlatform = (p: string) => {
    setFormPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const toggleBusinessType = (t: string) => {
    setMatchingBusinessTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const toggleStrategicGoal = (g: string) => {
    setMatchingGoals((prev) =>
      prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreatePackageInput = {
      code: formCode.trim().toUpperCase(),
      name: formName.trim(),
      name_ar: formNameAr.trim() || undefined,
      slug: formSlug.trim() || slugify(formCode + "-" + formName),
      category_id: formCategoryId || undefined,
      category_name: selectedCategoryName,
      package_type: formPackageType,
      billing_type: formBillingType,
      billing_unit: formBillingUnit.trim() || undefined,
      price: formPrice,
      proposed_price: formProposedPrice !== null && !isNaN(Number(formProposedPrice)) ? Number(formProposedPrice) : undefined,
      currency: formCurrency,
      custom_pricing: formCustomPricing,
      is_active: formIsActive,
      is_published: formIsPublished,
      is_featured: formIsFeatured,
      is_internal_only: formIsInternalOnly,
      approval_status: formApprovalStatus,
      cost_verification_status: formCostVerificationStatus,
      source_page_ref: formSourcePageRef.trim() || undefined,
      operational_notes: formOperationalNotes.trim() || undefined,
      ad_budget_separate: formAdBudgetSeparate,
      recommendation_enabled: formRecommendationEnabled,
      badge: formBadge,
      badge_ar: formBadgeAr.trim() || undefined,
      priority: formPriority,
      display_order: formDisplayOrder,
      short_description: formShortDesc.trim() || undefined,
      short_description_ar: formShortDescAr.trim() || undefined,
      description: formDesc.trim() || undefined,
      description_ar: formDescAr.trim() || undefined,
      monthly_reels: formMonthlyReels,
      monthly_posts: formMonthlyPosts,
      monthly_stories: formMonthlyStories.trim(),
      production_hours: formProductionHours,
      production_sessions: formProductionSessions,
      platforms: formPlatforms,
      has_ads_management: formHasAds,
      has_website: formHasWeb,
      has_strategy: formHasStrategy,
      has_community_management: formHasCommunity,
      website_scope: formHasWeb ? formWebScope.trim() || undefined : undefined,
      employee_cost: formEmployeeCost,
      freelancer_cost: formFreelancerCost,
      transport_cost: formTransportCost,
      subscription_allocation: formSubAlloc,
      commission: formCommission,
      included_items: formIncludedItems,
      excluded_items: formExcludedItems,
    };

    const success = await onSave(payload);
    if (success) {
      onOpenChange(false);
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.name}`,
  }));

  const packageTypeOptions = [
    { value: "standard", label: "Standard Retainer" },
    { value: "hybrid", label: "Hybrid (Content + Production)" },
    { value: "production", label: "Production Unit (Shooting)" },
    { value: "digital", label: "Digital Platform / Web" },
    { value: "custom", label: "Custom Scope" },
  ];

  const billingTypeOptions = [
    { value: "monthly", label: "Monthly (Recurring Retainer)" },
    { value: "one_time", label: "One-Time (Fixed Project)" },
    { value: "starting_from", label: "Starting From (Variable Scope)" },
    { value: "custom", label: "Custom Quote (Tailored)" },
  ];

  const badgeOptions = [
    { value: "", label: "No Badge" },
    { value: "most_popular", label: "Most Popular (Primary Spotlight)" },
    { value: "recommended", label: "Recommended (High Strategic Value)" },
    { value: "best_value", label: "Best Value (ROI Focused)" },
    { value: "featured", label: "Featured" },
  ];

  const approvalStatusOptions = [
    { value: "approved", label: "Approved (Official SADA Offering)" },
    { value: "proposed", label: "Proposed (Draft / Unapproved Price)" },
    { value: "needs_review", label: "Needs Review (Scope / Pricing Ambiguous)" },
  ];

  const costVerificationOptions = [
    { value: "verified", label: "Verified Costs (Direct cost allocations confirmed)" },
    { value: "unverified", label: "Unverified Costs (Unknown direct costs - do not assume zero)" },
    { value: "partial", label: "Partial Verification" },
  ];

  return (
    <SADADrawer
      open={open}
      onOpenChange={onOpenChange}
      width="full"
      showCloseButton={true}
      title={
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              {formCode || "NEW-PKG"}
            </span>
            <span className="font-display font-bold text-sm sm:text-lg text-foreground tracking-tight truncate">
              {mode === "create" ? "Create Package" : `Edit: ${formName || formCode}`}
            </span>
          </div>

          {/* Mode Switcher: Configuration vs Public Live Preview */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border shrink-0">
            <button
              type="button"
              onClick={() => setEditorMode("config")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                editorMode === "config"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="size-3.5 shrink-0" />
              <span>Config</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("preview")}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                editorMode === "preview"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="size-3.5 shrink-0 text-primary" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      }
      description="Manage commercial pricing, operational deliverable quotas, financial OS costs, and smart matching calibration."
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono text-muted-foreground bg-muted/40 sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg">
            <div className="flex items-center gap-1.5">
              <span>Price:</span>
              <span className="font-bold text-foreground">
                {formCustomPricing ? "Custom" : formatPackagePrice(formPrice, formCurrency)}
              </span>
            </div>
            <span className="text-muted-foreground/60">•</span>
            <div className="flex items-center gap-1.5">
              <span>Margin:</span>
              <span
                className={`font-bold ${
                  calculatedMargin >= 40
                    ? "text-emerald-600 dark:text-emerald-400"
                    : calculatedMargin >= 20
                    ? "text-amber-500"
                    : "text-rose-500"
                }`}
              >
                {formatGrossMargin(calculatedMargin)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <SADAButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 sm:flex-initial px-3 sm:px-4 min-h-[40px] text-xs whitespace-nowrap shrink-0"
            >
              Cancel
            </SADAButton>

            <SADAButton
              type="submit"
              form="package-editor-form"
              variant="primary"
              disabled={saving || !formCode.trim() || !formName.trim()}
              className="flex-1 sm:flex-initial gap-2 font-bold min-h-[40px] px-4 sm:px-6 text-xs whitespace-nowrap shrink-0 shadow-md"
            >
              <span>
                {saving
                  ? "Saving..."
                  : mode === "create"
                  ? "Create Package"
                  : "Save Changes"}
              </span>
              <ArrowRight className="size-4 shrink-0 rtl:rotate-180" />
            </SADAButton>
          </div>
        </div>
      }
    >
      {editorMode === "preview" ? (
        /* ============================================================
           TAB: LIVE PUBLIC PREVIEW
           Renders the EXACT PublicPackageCard component!
           ============================================================ */
        <div className="py-6 px-2 space-y-6 max-w-xl mx-auto">
          <div className="text-center space-y-1.5 pb-2 border-b border-border">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
              <Sparkles className="size-3.5 shrink-0" />
              <span>LIVE PUBLIC CARD PREVIEW</span>
            </div>
            <h4 className="text-xl font-bold font-display text-foreground">
              Real-time Preview on /pricing
            </h4>
            <p className="text-xs text-muted-foreground">
              This card renders the exact layout, deliverable chips, and hierarchy visible to visitors.
            </p>
          </div>

          <div className="pt-2">
            <PublicPackageCard
              package={livePreviewPackage}
              isPreview={true}
              onSelect={() => {}}
            />
          </div>
        </div>
      ) : (
        /* ============================================================
           TAB: STRUCTURED CONFIGURATION FORM
           Clear multi-section layout with section navigation pills
           ============================================================ */
        <div className="space-y-6">
          {/* Section Navigation Tabs */}
          <div className="sticky -top-5 z-20 bg-card/95 backdrop-blur-md pb-3 pt-1 border-b border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
              {[
                { id: "identity", label: isAr ? "1. الهوية" : "1. Identity", icon: Package },
                { id: "pricing", label: isAr ? "2. التكاليف" : "2. Pricing & Costs", icon: DollarSign },
                { id: "deliverables", label: isAr ? "3. المخرجات" : "3. Deliverables", icon: Layers },
                { id: "services", label: isAr ? "4. الخدمات" : "4. Services", icon: ListChecks },
                { id: "exclusions", label: isAr ? "5. الاستثناءات" : "5. Exclusions", icon: Ban },
                { id: "operations", label: isAr ? "6. العمليات" : "6. Operations", icon: Sliders },
                { id: "matching", label: isAr ? "7. المطابقة" : "7. Smart Matching", icon: Compass },
              ].map((tab) => {
                const isActive = activeSection === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id as SectionTab)}
                    className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 text-[11px] sm:text-xs ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form id="package-editor-form" onSubmit={handleSubmit} className="space-y-6">
            {/* ============================================================
                SECTION 1 — PACKAGE IDENTITY
               ============================================================ */}
            {activeSection === "identity" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      <span>1. Package Identity & Public Presentation</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Canonical code, multilingual titles, category, and display sequence.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Package Code *
                    </label>
                    <SADAInput
                      required
                      placeholder="e.g. MG-01"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      className="font-mono uppercase font-bold"
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      Canonical identifier in database & URLs.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Package Name (English) *
                    </label>
                    <SADAInput
                      required
                      placeholder="e.g. Growth+"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (!formSlug) setFormSlug(slugify(formCode + "-" + e.target.value));
                      }}
                      className="font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Package Name (Arabic)
                    </label>
                    <SADAInput
                      placeholder="مثال: باقة النمو بلس"
                      value={formNameAr}
                      onChange={(e) => setFormNameAr(e.target.value)}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Category *</label>
                    <SADASelect
                      value={formCategoryId}
                      onChange={setFormCategoryId}
                      options={categoryOptions}
                      size="default"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Package Type</label>
                    <SADASelect
                      value={formPackageType}
                      onChange={(e) => setFormPackageType(e as any)}
                      options={packageTypeOptions}
                      size="default"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Billing Frequency</label>
                    <SADASelect
                      value={formBillingType}
                      onChange={(e) => setFormBillingType(e as any)}
                      options={billingTypeOptions}
                      size="default"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Billing Unit</label>
                    <SADAInput
                      placeholder="e.g. month, session, day, reel"
                      value={formBillingUnit}
                      onChange={(e) => setFormBillingUnit(e.target.value)}
                      className="font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      Suffix displayed next to price.
                    </span>
                  </div>
                </div>

                {/* Catalog Governance & Source Document Tracking */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Catalog Governance & Source Audit</span>
                    <span className="text-[10px] font-normal text-muted-foreground/80">SADA Master Catalog Rules</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block text-xs">Approval Status *</label>
                      <SADASelect
                        value={formApprovalStatus}
                        onChange={(e) => setFormApprovalStatus(e as PackageApprovalStatus)}
                        options={approvalStatusOptions}
                        size="default"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Only Approved packages can ever be published publicly.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block text-xs">Source Page Reference</label>
                      <SADAInput
                        placeholder="e.g. Section 01 / Page 04"
                        value={formSourcePageRef}
                        onChange={(e) => setFormSourcePageRef(e.target.value)}
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Canonical reference to master specification document.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Public Badge</label>
                    <SADASelect
                      value={formBadge || ""}
                      onChange={(e) => setFormBadge((e || null) as any)}
                      options={badgeOptions}
                      size="default"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Arabic Badge Label
                    </label>
                    <SADAInput
                      placeholder="مثال: الأكثر طلباً"
                      value={formBadgeAr}
                      onChange={(e) => setFormBadgeAr(e.target.value)}
                      dir="rtl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">Display Order</label>
                    <SADANumberStepper
                      value={formDisplayOrder}
                      onChange={setFormDisplayOrder}
                      min={0}
                      max={999}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Short Positioning Statement (English)
                    </label>
                    <SADATextarea
                      rows={2}
                      value={formShortDesc}
                      onChange={(e) => setFormShortDesc(e.target.value)}
                      placeholder="e.g. Full social growth engine with active Meta Ads and weekly reporting."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Short Positioning Statement (Arabic)
                    </label>
                    <SADATextarea
                      rows={2}
                      value={formShortDescAr}
                      onChange={(e) => setFormShortDescAr(e.target.value)}
                      placeholder="مثال: منظومة نمو متكاملة مع إدارة إعلانات ميتا الممولة وتقارير أداء دورية."
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Public Visibility Cards */}
                <div className="pt-3 border-t border-border/70 space-y-2">
                  <span className="text-xs font-bold text-foreground block font-mono uppercase">
                    Visibility & Publishing Status
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                      <SADASwitch
                        checked={formIsInternalOnly}
                        onCheckedChange={setFormIsInternalOnly}
                        label="Internal Only"
                        description="Kept strictly internal for agency CRM"
                      />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                      <SADASwitch
                        checked={formIsPublished}
                        onCheckedChange={setFormIsPublished}
                        label="Published Publicly"
                        description="Exposed in public Pricing & matcher"
                      />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                      <SADASwitch
                        checked={formIsActive}
                        onCheckedChange={setFormIsActive}
                        label="Active for CRM"
                        description="Selectable in Deals & Contracts"
                      />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                      <SADASwitch
                        checked={formIsFeatured}
                        onCheckedChange={setFormIsFeatured}
                        label="Featured Package"
                        description="Prioritized in recommendations"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 2 — PRICING & DIRECT COSTS
               ============================================================ */}
            {activeSection === "pricing" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3">
                  <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>2. Commercial Pricing & Direct Cost Allocation</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Calibrate public pricing against direct costs to track gross profit and healthy margins.
                  </p>
                </div>

                {/* Commercial Selling Price */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                    <span>Commercial Selling & Proposed Price</span>
                    {formApprovalStatus === "proposed" && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-500/20">
                        Proposed Price / Unapproved
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block text-xs">Selling Price ({formCurrency}) *</label>
                      <SADAInput
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={String(formPrice)}
                        onChange={(e) => setFormPrice(Number(e.target.value))}
                        prefix="TND"
                        className="font-mono font-bold text-base"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block text-xs">Proposed Price (Draft)</label>
                      <SADAInput
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave empty if approved"
                        value={formProposedPrice !== null ? String(formProposedPrice) : ""}
                        onChange={(e) => setFormProposedPrice(e.target.value ? Number(e.target.value) : null)}
                        prefix="TND"
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-foreground block text-xs">Currency</label>
                      <SADAInput
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value)}
                        className="font-mono uppercase font-bold"
                      />
                    </div>

                    <div className="pt-5">
                      <SADASwitch
                        checked={formCustomPricing}
                        onCheckedChange={setFormCustomPricing}
                        label="Custom Scope Pricing"
                        description="Displays 'Custom Scope' instead of fixed price"
                      />
                    </div>
                  </div>
                </div>

                {/* Sponsoring / Ad Spend Separation Integrity Banner */}
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="size-4 text-blue-500 shrink-0" />
                      <span className="font-bold text-xs text-foreground">
                        Sponsoring & Media Ad Budget Separation
                      </span>
                    </div>
                    <SADASwitch
                      checked={formAdBudgetSeparate}
                      onCheckedChange={setFormAdBudgetSeparate}
                      label="Ad Budget Separate"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Preserves the strict financial distinction between SADA agency service revenue and the client's direct advertising budget.
                    (e.g., 1,290 TND package + 800 TND ad budget = 2,090 TND total client invoice, while SADA service revenue remains 1,290 TND).
                    Ad spend is <strong>never</strong> combined with agency fee when calculating package profit or gross margin.
                  </p>
                </div>

                {/* Cost Verification & Direct Costs Breakdown */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                      Direct Cost Engine Parameters (Financial OS)
                    </div>
                    <div className="w-64">
                      <SADASelect
                        value={formCostVerificationStatus}
                        onChange={(e) => setFormCostVerificationStatus(e as CostVerificationStatus)}
                        options={costVerificationOptions}
                        size="compact"
                      />
                    </div>
                  </div>

                  {formCostVerificationStatus === "unverified" && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Direct Costs Unverified</span>
                        <p className="text-[11px] mt-0.5 opacity-90">
                          Direct cost inputs (employee, freelancer, transport, subscription, commission) have not been verified. Unknown costs are not zero. Gross profit and margin are estimates and must NOT be treated as validated.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    <div className="space-y-1.5 p-3 rounded-2xl bg-card border border-border">
                      <label className="font-bold text-foreground block text-xs">Employee Cost</label>
                      <SADANumberStepper
                        value={formEmployeeCost}
                        onChange={setFormEmployeeCost}
                        min={0}
                        step={10}
                        unit="TND"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-2xl bg-card border border-border">
                      <label className="font-bold text-foreground block text-xs">Freelancer Cost</label>
                      <SADANumberStepper
                        value={formFreelancerCost}
                        onChange={setFormFreelancerCost}
                        min={0}
                        step={10}
                        unit="TND"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-2xl bg-card border border-border">
                      <label className="font-bold text-foreground block text-xs">Transport Cost</label>
                      <SADANumberStepper
                        value={formTransportCost}
                        onChange={setFormTransportCost}
                        min={0}
                        step={10}
                        unit="TND"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-2xl bg-card border border-border">
                      <label className="font-bold text-foreground block text-xs">Subscription Alloc.</label>
                      <SADANumberStepper
                        value={formSubAlloc}
                        onChange={setFormSubAlloc}
                        min={0}
                        step={5}
                        unit="TND"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1.5 p-3 rounded-2xl bg-card border border-border">
                      <label className="font-bold text-foreground block text-xs">Commission Alloc.</label>
                      <SADANumberStepper
                        value={formCommission}
                        onChange={setFormCommission}
                        min={0}
                        step={10}
                        unit="TND"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Profitability KPI Strip (Financial Command Center Style) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-muted/40 border border-border">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-muted-foreground font-bold block">
                      Total Direct Costs
                    </span>
                    <div className="font-mono text-2xl font-bold text-rose-500 tabular-nums">
                      {formatPackagePrice(totalDirectCosts, formCurrency)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Sum of employee, freelancer, transport & allocations
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-muted-foreground font-bold block">
                      Gross Profit
                    </span>
                    <div
                      className={`font-mono text-2xl font-bold tabular-nums ${
                        calculatedGrossProfit > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500"
                      }`}
                    >
                      {formatPackagePrice(calculatedGrossProfit, formCurrency)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Selling Price − Total Direct Costs
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-muted-foreground font-bold block">
                      Gross Margin %
                    </span>
                    <div
                      className={`font-mono text-2xl font-bold tabular-nums ${
                        calculatedMargin >= 40
                          ? "text-purple-600 dark:text-purple-400"
                          : calculatedMargin >= 20
                          ? "text-amber-500"
                          : "text-rose-500"
                      }`}
                    >
                      {formatGrossMargin(calculatedMargin)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Target benchmark: ≥ 40% margin
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 3 — INCLUDED DELIVERABLES (STRUCTURED QUOTAS)
               ============================================================ */}
            {activeSection === "deliverables" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3">
                  <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-500" />
                    <span>3. Structured Deliverable Quotas (For CRM & Production)</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Measurable deliverables displayed on public cards and synced to client project tasks.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  <div className="space-y-2 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                      <Film className="size-4 text-primary shrink-0" />
                      <span>Monthly Reels</span>
                    </div>
                    <SADANumberStepper
                      value={formMonthlyReels}
                      onChange={setFormMonthlyReels}
                      min={0}
                      max={100}
                      unit="reels"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span>Monthly Posts</span>
                    </div>
                    <SADANumberStepper
                      value={formMonthlyPosts}
                      onChange={setFormMonthlyPosts}
                      min={0}
                      max={100}
                      unit="posts"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                      <Flame className="size-4 text-primary shrink-0" />
                      <span>Stories Quota</span>
                    </div>
                    <SADAInput
                      value={formMonthlyStories}
                      onChange={(e) => setFormMonthlyStories(e.target.value)}
                      placeholder="e.g. Weekly Stories"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                      <Camera className="size-4 text-primary shrink-0" />
                      <span>Shoot Hours</span>
                    </div>
                    <SADANumberStepper
                      value={formProductionHours}
                      onChange={setFormProductionHours}
                      min={0}
                      max={100}
                      step={0.5}
                      unit="hrs"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2 p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                      <Camera className="size-4 text-primary shrink-0" />
                      <span>Shoot Sessions</span>
                    </div>
                    <SADANumberStepper
                      value={formProductionSessions}
                      onChange={setFormProductionSessions}
                      min={0}
                      max={50}
                      unit="shoots"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Platforms Selector */}
                <div className="pt-3 border-t border-border/70 space-y-2">
                  <span className="text-xs font-bold text-foreground block font-mono uppercase">
                    Covered Social & Digital Platforms
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["instagram", "facebook", "tiktok", "linkedin", "youtube"].map((p) => {
                      const isSelected = formPlatforms.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePlatform(p)}
                          className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isSelected ? `✓ ${p}` : `+ ${p}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 4 — INCLUDED SERVICES
               ============================================================ */}
            {activeSection === "services" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-purple-500" />
                      <span>4. Included Services & Deliverable List</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shown on the public pricing card in a clean 2-column layout.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                    {formIncludedItems.length} active items
                  </span>
                </div>

                {/* Quick Insert from Library */}
                <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                    Quick Insert from Official SADA Feature Library:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {OFFICIAL_FEATURE_LIBRARY.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleInsertLibraryFeature(item.en, item.ar)}
                        className="px-2.5 py-1 rounded-xl bg-card border border-border hover:border-primary/40 text-xs font-medium text-foreground transition-colors"
                      >
                        + {item.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Included Services List */}
                <div className="space-y-2">
                  {formIncludedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                        <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                          {item.text}
                        </span>
                        {item.text_ar && (
                          <span className="text-xs text-muted-foreground font-arabic truncate">
                            ({item.text_ar})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setFormIncludedItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-rose-500 p-1 transition-colors shrink-0"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Service Inputs */}
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
                  <SADAInput
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    placeholder="New service name (English)..."
                    className="flex-1"
                  />
                  <SADAInput
                    value={newFeatureTextAr}
                    onChange={(e) => setNewFeatureTextAr(e.target.value)}
                    placeholder="Arabic translation (optional)..."
                    className="flex-1"
                    dir="rtl"
                  />
                  <SADAButton
                    type="button"
                    onClick={handleAddIncludedFeature}
                    className="px-5 shrink-0 font-bold"
                  >
                    + Add Service
                  </SADAButton>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 5 — EXCLUSIONS
               ============================================================ */}
            {activeSection === "exclusions" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                      <span className="size-2 rounded-full bg-rose-500" />
                      <span>5. Explicit Exclusions (Out of Scope)</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Build trust through clear boundaries and transparent scope definitions.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground px-2.5 py-0.5 rounded-full bg-muted">
                    {formExcludedItems.length} exclusions
                  </span>
                </div>

                {/* Quick Insert from Library */}
                <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground block">
                    Quick Insert from Official SADA Exclusions Library:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {OFFICIAL_EXCLUSIONS_LIBRARY.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleInsertLibraryExclusion(item.en, item.ar)}
                        className="px-2.5 py-1 rounded-xl bg-card border border-border hover:border-rose-500/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        + {item.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Excluded Services List */}
                <div className="space-y-2">
                  {formExcludedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-muted/30 border border-border/70 text-muted-foreground"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-4 rounded-full bg-muted text-muted-foreground/60 grid place-items-center shrink-0">
                          <X className="size-2.5 stroke-[2.5]" />
                        </span>
                        <span className="font-semibold text-xs sm:text-sm text-foreground/80 truncate">
                          {item.text}
                        </span>
                        {item.text_ar && (
                          <span className="text-xs text-muted-foreground/60 font-arabic truncate">
                            ({item.text_ar})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setFormExcludedItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-rose-500 p-1 transition-colors shrink-0"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Exclusion Inputs */}
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row gap-2">
                  <SADAInput
                    value={newExclusionText}
                    onChange={(e) => setNewExclusionText(e.target.value)}
                    placeholder="Excluded item (e.g. Sponsoring / Ad Budget)..."
                    className="flex-1"
                  />
                  <SADAInput
                    value={newExclusionTextAr}
                    onChange={(e) => setNewExclusionTextAr(e.target.value)}
                    placeholder="Arabic translation (optional)..."
                    className="flex-1"
                    dir="rtl"
                  />
                  <SADAButton
                    type="button"
                    variant="secondary"
                    onClick={handleAddExcludedFeature}
                    className="px-5 shrink-0 font-bold"
                  >
                    + Add Exclusion
                  </SADAButton>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 6 — OPERATIONAL FLAGS
               ============================================================ */}
            {activeSection === "operations" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3">
                  <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" />
                    <span>6. High-Impact Operational Flags</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clear toggle cards defining enterprise scope and capability assignments.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Meta Ads Card */}
                  <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Target className="size-5 text-primary shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-foreground">
                            Meta Ads Management
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Paid campaigns on Facebook & Instagram
                          </div>
                        </div>
                      </div>
                      <SADASwitch checked={formHasAds} onCheckedChange={setFormHasAds} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Includes pixel configuration, custom conversions, creative A/B testing and monthly ad budget optimization.
                    </p>
                  </div>

                  {/* Website Included Card */}
                  <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Globe className="size-5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-foreground">Website Included</div>
                          <div className="text-xs text-muted-foreground">
                            Digital architecture & hosting
                          </div>
                        </div>
                      </div>
                      <SADASwitch checked={formHasWeb} onCheckedChange={setFormHasWeb} />
                    </div>
                    {formHasWeb ? (
                      <SADAInput
                        value={formWebScope}
                        onChange={(e) => setFormWebScope(e.target.value)}
                        placeholder="Website scope (e.g. 5-Page Showcase Website + Custom CMS)"
                        className="text-xs"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Enables digital platform builds, custom CMS, or booking system deliverables.
                      </p>
                    )}
                  </div>

                  {/* Marketing Strategy Card */}
                  <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Compass className="size-5 text-emerald-500 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-foreground">Marketing Strategy</div>
                          <div className="text-xs text-muted-foreground">
                            Monthly strategic roadmap
                          </div>
                        </div>
                      </div>
                      <SADASwitch checked={formHasStrategy} onCheckedChange={setFormHasStrategy} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Includes quarterly market repositioning, competitor tracking, and growth consultation.
                    </p>
                  </div>

                  {/* Community Moderation Card */}
                  <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Flame className="size-5 text-blue-500 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-foreground">
                            Community Moderation
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Direct message & comment management
                          </div>
                        </div>
                      </div>
                      <SADASwitch
                        checked={formHasCommunity}
                        onCheckedChange={setFormHasCommunity}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Active community management, customer response SLA, and triage of leads.
                    </p>
                  </div>
                </div>

                {/* Scope Limits, Operational Rules & Production Constraints */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-foreground block text-xs">
                      Scope Limits, Visit Rules & Operational Constraints
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      SADA Master Guidelines
                    </span>
                  </div>
                  <SADATextarea
                    rows={3}
                    value={formOperationalNotes}
                    onChange={(e) => setFormOperationalNotes(e.target.value)}
                    placeholder="e.g. Max 2 story visits/week, max 2h/visit, max 4h production session, 2 rounds of edits, express delivery surcharge +50%/+100%."
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Preserves the documented operational rules for visit durations, production hours, story visit schedules, and revision limits.
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================
                SECTION 7 — MATCHING / SALES INTELLIGENCE
               ============================================================ */}
            {activeSection === "matching" && (
              <div className="space-y-5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-card border border-border elevated-shadow">
                <div className="border-b border-border/70 pb-3">
                  <h4 className="font-bold text-base font-display text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    <span>7. Smart Matching & Sales Intelligence</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Calibrate this package's profile for the SADA Smart Package Matcher intake engine.
                  </p>
                </div>

                {/* Matcher Eligibility Toggle */}
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground">
                      Eligible for Smart Package Matcher
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, this package is evaluated by the public Smart Package Matcher. Note: Only <strong>Approved & Published Public</strong> packages will ever be returned to anonymous visitors.
                    </p>
                  </div>
                  <SADASwitch
                    checked={formRecommendationEnabled}
                    onCheckedChange={setFormRecommendationEnabled}
                  />
                </div>

                {/* Target Business Types */}
                <div className="space-y-2">
                  <label className="font-bold text-foreground block text-xs">
                    Best Suited Business Sectors:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_BUSINESS_TYPES.map((bt) => {
                      const isSelected = matchingBusinessTypes.includes(bt.id);
                      return (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => toggleBusinessType(bt.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isSelected ? `✓ ${bt.label}` : `+ ${bt.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Strategic Goals */}
                <div className="space-y-2 pt-2">
                  <label className="font-bold text-foreground block text-xs">
                    Primary Strategic Goals Solved:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_STRATEGIC_GOALS.map((goal) => {
                      const isSelected = matchingGoals.includes(goal.id);
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => toggleStrategicGoal(goal.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isSelected ? `✓ ${goal.label}` : `+ ${goal.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Suitable Growth Stage & Budget Band */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Suitable Growth Stage
                    </label>
                    <SADASelect
                      value={matchingStage}
                      onChange={setMatchingStage}
                      options={GROWTH_STAGES.map((s) => ({ value: s.id, label: s.label }))}
                      size="default"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Comfortable Budget Min (TND)
                    </label>
                    <SADAInput
                      type="number"
                      value={String(matchingBudgetMin)}
                      onChange={(e) => setMatchingBudgetMin(Number(e.target.value))}
                      prefix="TND"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-foreground block text-xs">
                      Comfortable Budget Max (TND)
                    </label>
                    <SADAInput
                      type="number"
                      value={String(matchingBudgetMax)}
                      onChange={(e) => setMatchingBudgetMax(Number(e.target.value))}
                      prefix="TND"
                    />
                  </div>
                </div>

                {/* Positioning Statement */}
                <div className="space-y-1.5 pt-2">
                  <label className="font-bold text-foreground block text-xs">
                    Sales Rep & Consultant Positioning Statement
                  </label>
                  <SADATextarea
                    rows={3}
                    value={matchingPositioning}
                    onChange={(e) => setMatchingPositioning(e.target.value)}
                    placeholder="e.g. Recommended for dining & retail concepts seeking rapid social presence with dynamic video reels and monthly on-site production."
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </SADADrawer>
  );
}
