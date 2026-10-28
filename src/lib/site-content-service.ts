// ============================================================
// SADA WORK OS — SITE CONTENT CMS SERVICE
// Authoritative service for Homepage KPIs, Proof Stats & Trusted Partners
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export interface SiteKpi {
  id: string;
  section: "hero_proof" | "company_stats";
  metric_key: string;
  value: number;
  prefix?: string;
  suffix?: string;
  label_en: string;
  label_ar: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TrustedPartner {
  id: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  hover_description?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SiteContentSection {
  id: string;
  title_en: string;
  title_ar: string;
  subtitle_en?: string | null;
  subtitle_ar?: string | null;
  updated_at?: string;
}

// Default Fallbacks for Hero Proof
export const DEFAULT_HERO_PROOFS: SiteKpi[] = [
  {
    id: "def-hero-1",
    section: "hero_proof",
    metric_key: "hero_happy_clients",
    value: 50,
    prefix: "",
    suffix: "+",
    label_en: "Happy Clients",
    label_ar: "عميل يثق بنا",
    icon: "Users",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "def-hero-2",
    section: "hero_proof",
    metric_key: "hero_projects_delivered",
    value: 120,
    prefix: "",
    suffix: "+",
    label_en: "Projects Delivered",
    label_ar: "مشروعاً تم تسليمه",
    icon: "Briefcase",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "def-hero-3",
    section: "hero_proof",
    metric_key: "hero_client_growth",
    value: 3,
    prefix: "",
    suffix: "x",
    label_en: "Average Client Growth",
    label_ar: "متوسط نمو أعمال العميل",
    icon: "TrendingUp",
    sort_order: 3,
    is_active: true,
  },
];

// Default Fallbacks for Company Stats Bar
export const DEFAULT_COMPANY_STATS: SiteKpi[] = [
  {
    id: "def-stat-1",
    section: "company_stats",
    metric_key: "stats_projects_shipped",
    value: 120,
    prefix: "",
    suffix: "+",
    label_en: "Projects shipped",
    label_ar: "مشروعاً منجزاً",
    icon: "Rocket",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "def-stat-2",
    section: "company_stats",
    metric_key: "stats_views_generated",
    value: 38,
    prefix: "",
    suffix: "M",
    label_en: "Views generated",
    label_ar: "مشاهدة محققة",
    icon: "Eye",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "def-stat-3",
    section: "company_stats",
    metric_key: "stats_client_retention",
    value: 96,
    prefix: "",
    suffix: "%",
    label_en: "Client retention",
    label_ar: "نسبة استبقاء العملاء",
    icon: "HeartHandshake",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "def-stat-4",
    section: "company_stats",
    metric_key: "stats_avg_response_time",
    value: 24,
    prefix: "",
    suffix: "h",
    label_en: "Avg. response time",
    label_ar: "متوسط سرعة الاستجابة",
    icon: "Clock",
    sort_order: 4,
    is_active: true,
  },
];

// Default Fallbacks for Trusted Partners
export const DEFAULT_PARTNERS: TrustedPartner[] = [
  { id: "p-1", name: "Noor Coffee", website_url: "https://noorcoffee.com", sort_order: 1, is_active: true },
  { id: "p-2", name: "Maven Studio", website_url: "https://mavenstudio.com", sort_order: 2, is_active: true },
  { id: "p-3", name: "Atlas Realty", website_url: "https://atlasrealty.com", sort_order: 3, is_active: true },
  { id: "p-4", name: "Olive House", website_url: "https://olivehouse.com", sort_order: 4, is_active: true },
  { id: "p-5", name: "Lumen", website_url: "https://lumen.com", sort_order: 5, is_active: true },
  { id: "p-6", name: "Verde & Co.", website_url: "https://verdeandco.com", sort_order: 6, is_active: true },
  { id: "p-7", name: "Northbeam", website_url: "https://northbeam.io", sort_order: 7, is_active: true },
  { id: "p-8", name: "Field Notes", website_url: "https://fieldnotesbrand.com", sort_order: 8, is_active: true },
];

export const DEFAULT_TRUSTED_BY_SECTION: SiteContentSection = {
  id: "trusted_by",
  title_en: "TRUSTED BY FORWARD-THINKING COMPANIES",
  title_ar: "شركات رائدة تضع ثقتها في صدى",
  subtitle_en: "Selected enterprise and boutique partners we have grown with",
  subtitle_ar: "نخبة من العلامات والشركات الرائدة التي بنينا معها قصص نجاح مستدامة",
};

// ------------------------------------------------------------
// DATA ACCESS & MUTATION FUNCTIONS
// ------------------------------------------------------------

/**
 * Fetch KPIs (all or filtered by section)
 */
export async function fetchSiteKpis(section?: "hero_proof" | "company_stats"): Promise<SiteKpi[]> {
  try {
    let query = (supabase as any)
      .from("site_kpis")
      .select("*")
      .order("sort_order", { ascending: true });

    if (section) {
      query = query.eq("section", section);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[SiteContentService] Fallback to default KPIs due to fetch error:", error);
      if (section === "hero_proof") return DEFAULT_HERO_PROOFS;
      if (section === "company_stats") return DEFAULT_COMPANY_STATS;
      return [...DEFAULT_HERO_PROOFS, ...DEFAULT_COMPANY_STATS];
    }

    if (!data || data.length === 0) {
      if (section === "hero_proof") return DEFAULT_HERO_PROOFS;
      if (section === "company_stats") return DEFAULT_COMPANY_STATS;
      return [...DEFAULT_HERO_PROOFS, ...DEFAULT_COMPANY_STATS];
    }

    return data as SiteKpi[];
  } catch (err) {
    console.warn("[SiteContentService] Exception in fetchSiteKpis, using fallback:", err);
    if (section === "hero_proof") return DEFAULT_HERO_PROOFS;
    if (section === "company_stats") return DEFAULT_COMPANY_STATS;
    return [...DEFAULT_HERO_PROOFS, ...DEFAULT_COMPANY_STATS];
  }
}

/**
 * Save / update a KPI
 */
export async function upsertSiteKpi(kpi: Partial<SiteKpi>): Promise<SiteKpi> {
  // New rows use temporary client IDs while being edited. The database owns
  // the UUID, so only send IDs that are valid UUIDs for existing rows.
  const isUuid = typeof kpi.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(kpi.id);
  const payload: any = {
    ...kpi,
    updated_at: new Date().toISOString(),
  };
  if (!isUuid) delete payload.id;

  const { data, error } = await (supabase as any)
    .from("site_kpis")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as SiteKpi;
}

/**
 * Delete a KPI
 */
export async function deleteSiteKpi(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("site_kpis")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Fetch Trusted Partners
 */
export async function fetchTrustedPartners(activeOnly = true): Promise<TrustedPartner[]> {
  try {
    let query = (supabase as any)
      .from("trusted_partners")
      .select("*")
      .order("sort_order", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[SiteContentService] Fallback to default partners due to fetch error:", error);
      return DEFAULT_PARTNERS;
    }

    if (!data || data.length === 0) {
      return DEFAULT_PARTNERS;
    }

    return data as TrustedPartner[];
  } catch (err) {
    console.warn("[SiteContentService] Exception in fetchTrustedPartners, using fallback:", err);
    return DEFAULT_PARTNERS;
  }
}

/**
 * Save / update a Trusted Partner
 */
export async function upsertTrustedPartner(partner: Partial<TrustedPartner>): Promise<TrustedPartner> {
  const payload: any = {
    ...partner,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("trusted_partners")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as TrustedPartner;
}

/**
 * Delete a Trusted Partner
 */
export async function deleteTrustedPartner(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("trusted_partners")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Fetch Section Content
 */
export async function fetchContentSection(id: string): Promise<SiteContentSection> {
  try {
    const { data, error } = await (supabase as any)
      .from("site_content_sections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      if (id === "trusted_by") return DEFAULT_TRUSTED_BY_SECTION;
      return { id, title_en: "", title_ar: "" };
    }

    return data as SiteContentSection;
  } catch {
    if (id === "trusted_by") return DEFAULT_TRUSTED_BY_SECTION;
    return { id, title_en: "", title_ar: "" };
  }
}

/**
 * Update Section Content
 */
export async function updateContentSection(
  id: string,
  updates: Partial<SiteContentSection>
): Promise<SiteContentSection> {
  const payload: any = {
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("site_content_sections")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as SiteContentSection;
}

/**
 * Upload Partner Logo into Supabase Storage
 */
export async function uploadPartnerLogo(file: File): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const cleanExt = (fileExt || "png").toLowerCase();
  const fileName = `partner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt}`;
  const filePath = `partners/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from("media")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}
