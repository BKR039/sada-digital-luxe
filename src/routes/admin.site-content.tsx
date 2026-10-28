import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  Sparkles,
  Layers,
  Users,
  Briefcase,
  TrendingUp,
  Globe,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Upload,
  Check,
  Eye,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  RefreshCw,
  Search,
  CheckCircle2,
  Image as ImageIcon,
  Rocket,
  HeartHandshake,
  Clock,
  Award,
  Star,
  Zap,
  Shield,
  Target,
  Flame,
  Activity,
  BarChart3,
  Sliders,
  ChevronDown,
} from "lucide-react";
import {
  fetchSiteKpis,
  upsertSiteKpi,
  deleteSiteKpi,
  fetchTrustedPartners,
  upsertTrustedPartner,
  deleteTrustedPartner,
  fetchContentSection,
  updateContentSection,
  uploadPartnerLogo,
  SiteKpi,
  TrustedPartner,
  SiteContentSection,
  DEFAULT_HERO_PROOFS,
  DEFAULT_COMPANY_STATS,
  DEFAULT_PARTNERS,
  DEFAULT_TRUSTED_BY_SECTION,
} from "@/lib/site-content-service";
import { DynamicIcon, AVAILABLE_CMS_ICONS, CmsIconName } from "@/components/common/DynamicIcon";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/admin/site-content")({
  component: SiteContentAdminPage,
});

// ------------------------------------------------------------
// ICON PICKER POPOVER / MODAL COMPONENT
// ------------------------------------------------------------
interface IconPickerProps {
  currentIcon?: string;
  onSelect: (iconName: string) => void;
  title?: string;
}

function IconPicker({ currentIcon, onSelect, title = "Select Icon" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return AVAILABLE_CMS_ICONS;
    return AVAILABLE_CMS_ICONS.filter((name) =>
      name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [search]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted transition text-xs font-medium text-foreground cursor-pointer"
        title="Change icon"
      >
        <span className="p-1 rounded-md bg-primary/10 text-primary dark:text-cyan-400">
          <DynamicIcon name={currentIcon || "Sparkles"} className="size-4" />
        </span>
        <span className="truncate max-w-[100px]">{currentIcon || "Choose Icon"}</span>
        <ChevronDown className="size-3 text-muted-foreground ml-auto" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an icon for this metric. It will be displayed across the website and responsive mobile layouts.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search icons (e.g. Users, Rocket, Clock)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1">
            {filteredIcons.map((iconName) => {
              const isSelected = currentIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    onSelect(iconName);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/15 text-primary dark:text-cyan-400 shadow-sm font-semibold"
                      : "border-border/60 hover:border-primary/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <DynamicIcon name={iconName} className="size-5" />
                  <span className="text-[10px] truncate max-w-full">{iconName}</span>
                </button>
              );
            })}
          </div>

          <DialogFooter className="sm:justify-between items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {filteredIcons.length} icons available
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------
// MAIN ADMIN PAGE COMPONENT
// ------------------------------------------------------------
export function SiteContentAdminPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  // Data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("hero_proof");

  // Hero Proof KPIs
  const [heroKpis, setHeroKpis] = useState<SiteKpi[]>([]);
  const [savingHeroId, setSavingHeroId] = useState<string | null>(null);

  // Trusted By Section
  const [trustedSection, setTrustedSection] = useState<SiteContentSection>(DEFAULT_TRUSTED_BY_SECTION);
  const [savingSection, setSavingSection] = useState(false);
  const [partners, setPartners] = useState<TrustedPartner[]>([]);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partial<TrustedPartner> | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<TrustedPartner | null>(null);

  // Company Performance KPIs (Stats Bar)
  const [statsKpis, setStatsKpis] = useState<SiteKpi[]>([]);
  const [savingStatId, setSavingStatId] = useState<string | null>(null);

  // Kpi deletion state
  const [kpiToDelete, setKpiToDelete] = useState<SiteKpi | null>(null);

  // Preview interactive state
  const [previewLang, setPreviewLang] = useState<"en" | "ar">(isAr ? "ar" : "en");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all initial content
  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [heroData, statsData, partnersData, sectionData] = await Promise.all([
        fetchSiteKpis("hero_proof"),
        fetchSiteKpis("company_stats"),
        fetchTrustedPartners(false),
        fetchContentSection("trusted_by"),
      ]);

      setHeroKpis(heroData);
      setStatsKpis(statsData);
      setPartners(partnersData);
      setTrustedSection(sectionData);
    } catch (err) {
      console.error("[SiteContentAdmin] Error loading content:", err);
      toast.error("Failed to load site content. Using local cached defaults.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ----------------------------------------------------------
  // HERO PROOF ACTIONS
  // ----------------------------------------------------------
  const handleHeroChange = (id: string, field: keyof SiteKpi, value: any) => {
    setHeroKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const handleSaveHeroKpi = async (kpi: SiteKpi) => {
    setSavingHeroId(kpi.id);
    try {
      const updated = await upsertSiteKpi(kpi);
      setHeroKpis((prev) => prev.map((k) => (k.id === kpi.id ? updated : k)));
      toast.success(isAr ? "تم حفظ المؤشر بنجاح" : `Hero proof "${kpi.label_en}" saved successfully`);
    } catch (err: any) {
      console.error("Save hero KPI failed:", err);
      toast.error(err.message || "Failed to save Hero KPI");
    } finally {
      setSavingHeroId(null);
    }
  };

  const handleAddHeroKpi = () => {
    const newKpi: SiteKpi = {
      id: `hero_${Date.now()}`,
      section: "hero_proof",
      metric_key: `hero_metric_${Date.now()}`,
      value: 100,
      prefix: "",
      suffix: "+",
      label_en: "New Milestone",
      label_ar: "إنجاز جديد",
      icon: "Award",
      sort_order: heroKpis.length + 1,
      is_active: true,
    };
    setHeroKpis((prev) => [...prev, newKpi]);
  };

  const handleDeleteKpiConfirm = async () => {
    if (!kpiToDelete) return;
    try {
      // Unsaved fallback rows and newly added rows have client-side IDs only.
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(kpiToDelete.id)) {
        await deleteSiteKpi(kpiToDelete.id);
      }
      if (kpiToDelete.section === "hero_proof") {
        setHeroKpis((prev) => prev.filter((k) => k.id !== kpiToDelete.id));
      } else {
        setStatsKpis((prev) => prev.filter((k) => k.id !== kpiToDelete.id));
      }
      toast.success(isAr ? "تم حذف المؤشر بنجاح" : "Metric deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete metric");
    } finally {
      setKpiToDelete(null);
    }
  };

  // ----------------------------------------------------------
  // TRUSTED PARTNERS ACTIONS
  // ----------------------------------------------------------
  const handleSaveSection = async () => {
    setSavingSection(true);
    try {
      const updated = await updateContentSection("trusted_by", trustedSection);
      setTrustedSection(updated);
      toast.success(isAr ? "تم تحديث عنوان قسم الشركاء" : "Partners section title updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update section header");
    } finally {
      setSavingSection(false);
    }
  };

  const handleOpenAddPartner = () => {
    setEditingPartner({
      name: "",
      logo_url: "",
      website_url: "https://",
      hover_description: "",
      sort_order: partners.length + 1,
      is_active: true,
    });
    setPartnerModalOpen(true);
  };

  const handleOpenEditPartner = (p: TrustedPartner) => {
    setEditingPartner({ ...p });
    setPartnerModalOpen(true);
  };

  const handleSavePartnerModal = async () => {
    if (!editingPartner || !editingPartner.name?.trim()) {
      toast.error("Partner brand name is required");
      return;
    }

    try {
      const payload: Partial<TrustedPartner> = {
        ...editingPartner,
        name: editingPartner.name.trim(),
        website_url: editingPartner.website_url?.trim() || null,
        hover_description: editingPartner.hover_description?.trim() || null,
        logo_url: editingPartner.logo_url?.trim() || null,
        sort_order: Number(editingPartner.sort_order) || 1,
        is_active: editingPartner.is_active ?? true,
      };

      const saved = await upsertTrustedPartner(payload);
      setPartners((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        if (exists) {
          return prev.map((p) => (p.id === saved.id ? saved : p));
        }
        return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order);
      });

      toast.success(isAr ? "تم حفظ بيانات الشريك" : `Partner "${saved.name}" saved successfully`);
      setPartnerModalOpen(false);
      setEditingPartner(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save partner");
    }
  };

  const handleDeletePartnerConfirm = async () => {
    if (!partnerToDelete) return;
    try {
      await deleteTrustedPartner(partnerToDelete.id);
      setPartners((prev) => prev.filter((p) => p.id !== partnerToDelete.id));
      toast.success(isAr ? "تم حذف الشريك بنجاح" : `Partner "${partnerToDelete.name}" removed`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete partner");
    } finally {
      setPartnerToDelete(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, SVG, WEBP, or JPG)");
      return;
    }

    setUploadingLogo(true);
    try {
      const publicUrl = await uploadPartnerLogo(file);
      setEditingPartner((prev) => ({
        ...prev,
        logo_url: publicUrl,
      }));
      toast.success("Logo uploaded successfully!");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Failed to upload logo image");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ----------------------------------------------------------
  // COMPANY STATS ACTIONS
  // ----------------------------------------------------------
  const handleStatChange = (id: string, field: keyof SiteKpi, value: any) => {
    setStatsKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const handleSaveStatKpi = async (kpi: SiteKpi) => {
    setSavingStatId(kpi.id);
    try {
      const updated = await upsertSiteKpi(kpi);
      setStatsKpis((prev) => prev.map((k) => (k.id === kpi.id ? updated : k)));
      toast.success(isAr ? "تم حفظ رقم الأداء بنجاح" : `KPI "${kpi.label_en}" saved successfully`);
    } catch (err: any) {
      console.error("Save stat KPI failed:", err);
      toast.error(err.message || "Failed to save Stat KPI");
    } finally {
      setSavingStatId(null);
    }
  };

  const handleAddStatKpi = () => {
    const newKpi: SiteKpi = {
      id: `stat_${Date.now()}`,
      section: "company_stats",
      metric_key: `stats_metric_${Date.now()}`,
      value: 100,
      prefix: "",
      suffix: "%",
      label_en: "Customer Satisfaction",
      label_ar: "رضا العملاء",
      icon: "Star",
      sort_order: statsKpis.length + 1,
      is_active: true,
    };
    setStatsKpis((prev) => [...prev, newKpi]);
  };

  // Quick Reset to system defaults helper
  const handleResetSectionDefaults = async (type: "hero" | "partners" | "stats") => {
    if (!confirm("Are you sure you want to reset this section to original production defaults?")) return;
    try {
      if (type === "hero") {
        for (const item of DEFAULT_HERO_PROOFS) {
          await upsertSiteKpi(item);
        }
        setHeroKpis(DEFAULT_HERO_PROOFS);
      } else if (type === "stats") {
        for (const item of DEFAULT_COMPANY_STATS) {
          await upsertSiteKpi(item);
        }
        setStatsKpis(DEFAULT_COMPANY_STATS);
      } else if (type === "partners") {
        await updateContentSection("trusted_by", DEFAULT_TRUSTED_BY_SECTION);
        setTrustedSection(DEFAULT_TRUSTED_BY_SECTION);
        for (const item of DEFAULT_PARTNERS) {
          await upsertTrustedPartner(item);
        }
        setPartners(DEFAULT_PARTNERS);
      }
      toast.success("Section reset to default initial data.");
    } catch (err: any) {
      toast.error(err.message || "Reset failed");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 md:px-8" dir={isRTL ? "rtl" : "ltr"}>
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent text-primary dark:text-cyan-400 border border-primary/20">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
                {isAr ? "إدارة إحصائيات وشركاء الموقع" : "Site Content & Metrics CMS"}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {isAr
                  ? "تعديل إحصائيات الهيرو، شعارات وروابط شركاء النجاح، وأرقام شريط الأداء فورياً"
                  : "Live control panel for Hero proof highlights, trusted partner brands, and performance KPIs"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="rounded-xl border-border/70 text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            {isAr ? "تحديث البيانات" : "Refresh Data"}
          </Button>

          <Link
            to="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm h-9"
          >
            <Eye className="size-3.5" />
            <span>{isAr ? "معاينة الموقع المباشر" : "View Live Site"}</span>
            <ExternalLink className="size-3 opacity-80" />
          </Link>
        </div>
      </div>

      {/* MAIN TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 p-1.5 rounded-2xl bg-muted/60 border border-border/60 h-auto gap-1">
          <TabsTrigger
            value="hero_proof"
            className="rounded-xl py-2.5 text-xs md:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Flame className="size-4 text-amber-500" />
            <span>{isAr ? "مؤشرات الهيرو (3)" : "Hero Highlights (3)"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="trusted_partners"
            className="rounded-xl py-2.5 text-xs md:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Users className="size-4 text-blue-500" />
            <span>{isAr ? "شركاء النجاح والشعارات" : "Trusted Partners & Logos"}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] rounded-md ml-1 font-mono">
              {partners.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="company_stats"
            className="rounded-xl py-2.5 text-xs md:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <BarChart3 className="size-4 text-emerald-500" />
            <span>{isAr ? "شريط الأداء (Stats Bar)" : "Performance KPIs (Stats)"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="preview"
            className="rounded-xl py-2.5 text-xs md:text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Eye className="size-4 text-purple-500" />
            <span>{isAr ? "المعاينة الحية التفاعلية" : "Interactive Live Preview"}</span>
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: HERO PROOF HIGHLIGHTS */}
        {/* ======================================================== */}
        <TabsContent value="hero_proof" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Flame className="size-4 text-amber-500" />
                {isAr ? "أرقام ومؤشرات الهيرو الرئيسية" : "Hero Proof Metrics"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "تظهر هذه المؤشرات بجانب الأزرار الرئيسية في واجهة الصفحة، تدعم النص العربي والإنجليزي والأيقونات"
                  : "These 3 key proof chips appear directly under the main Hero headline with animated counters"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetSectionDefaults("hero")}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <RotateCcw className="size-3 mr-1" />
                {isAr ? "استعادة الافتراضي" : "Reset Defaults"}
              </Button>
              <Button
                onClick={handleAddHeroKpi}
                size="sm"
                className="rounded-xl text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="size-3.5" />
                {isAr ? "إضافة مؤشر" : "Add Metric"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {heroKpis.map((kpi, index) => (
              <div
                key={kpi.id}
                className={`relative flex flex-col justify-between rounded-3xl border bg-card p-5 transition-all shadow-xs ${
                  kpi.is_active ? "border-border/80" : "border-border/40 opacity-70 bg-muted/20"
                }`}
              >
                <div>
                  {/* Card top banner */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center size-6 rounded-lg bg-primary/10 text-primary dark:text-cyan-400 font-mono text-xs font-bold">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {kpi.metric_key}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`active-hero-${kpi.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
                          {kpi.is_active ? (isAr ? "مفعّل" : "Active") : (isAr ? "معطّل" : "Hidden")}
                        </Label>
                        <Switch
                          id={`active-hero-${kpi.id}`}
                          checked={kpi.is_active}
                          onCheckedChange={(val) => handleHeroChange(kpi.id, "is_active", val)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Icon and Number settings */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الأيقونة" : "Icon Picker"}
                        </Label>
                        <IconPicker
                          currentIcon={kpi.icon}
                          onSelect={(newIcon) => handleHeroChange(kpi.id, "icon", newIcon)}
                          title={`Select Icon for ${kpi.label_en}`}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الترتيب" : "Sort Order"}
                        </Label>
                        <Input
                          type="number"
                          value={kpi.sort_order}
                          onChange={(e) => handleHeroChange(kpi.id, "sort_order", Number(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Numeric Value & Suffix */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "البادئة" : "Prefix"}
                        </Label>
                        <Input
                          placeholder="e.g. $"
                          value={kpi.prefix || ""}
                          onChange={(e) => handleHeroChange(kpi.id, "prefix", e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block font-semibold text-foreground">
                          {isAr ? "الرقم الأساسي" : "Number Value *"}
                        </Label>
                        <Input
                          type="number"
                          value={kpi.value}
                          onChange={(e) => handleHeroChange(kpi.id, "value", Number(e.target.value))}
                          className="h-9 text-sm font-bold font-mono text-primary dark:text-cyan-400"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "اللاحقة" : "Suffix (e.g. +, x)"}
                        </Label>
                        <Input
                          placeholder="e.g. +"
                          value={kpi.suffix || ""}
                          onChange={(e) => handleHeroChange(kpi.id, "suffix", e.target.value)}
                          className="h-9 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Bilingual Labels */}
                    <div className="space-y-2 pt-1">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 flex items-center justify-between">
                          <span>{isAr ? "الوصف بالإنجليزية" : "English Label *"}</span>
                          <span className="text-[10px] text-muted-foreground/70">EN</span>
                        </Label>
                        <Input
                          value={kpi.label_en}
                          onChange={(e) => handleHeroChange(kpi.id, "label_en", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="e.g. Happy Clients"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 flex items-center justify-between">
                          <span>{isAr ? "الوصف بالعربية" : "Arabic Label *"}</span>
                          <span className="text-[10px] text-muted-foreground/70">AR</span>
                        </Label>
                        <Input
                          dir="rtl"
                          value={kpi.label_ar}
                          onChange={(e) => handleHeroChange(kpi.id, "label_ar", e.target.value)}
                          className="h-8 text-xs font-arabic"
                          placeholder="مثال: عميل يثق بنا"
                        />
                      </div>
                    </div>

                    {/* Live Chip Simulation */}
                    <div className="pt-2">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5 block">
                        {isAr ? "معاينة المظهر على الموقع" : "Live Visual Preview"}
                      </Label>
                      <div className="p-3 rounded-2xl bg-zinc-950 text-white border border-white/10 flex items-center gap-3">
                        <span className="p-2 rounded-xl bg-white/10 text-cyan-400">
                          <DynamicIcon name={kpi.icon} className="size-4" />
                        </span>
                        <div>
                          <div className="text-base font-bold font-display tracking-tight text-white flex items-baseline gap-0.5">
                            {kpi.prefix && <span>{kpi.prefix}</span>}
                            <span>{kpi.value}</span>
                            <span className="text-cyan-400">{kpi.suffix}</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 font-medium">
                            {kpi.label_en} • <span className="font-arabic">{kpi.label_ar}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKpiToDelete(kpi)}
                    className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {isAr ? "حذف" : "Delete"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleSaveHeroKpi(kpi)}
                    disabled={savingHeroId === kpi.id}
                    className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  >
                    {savingHeroId === kpi.id ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                    {isAr ? "حفظ التغييرات" : "Save Changes"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: TRUSTED PARTNERS & LOGOS */}
        {/* ======================================================== */}
        <TabsContent value="trusted_partners" className="mt-6 space-y-6">
          {/* Section Title Editor */}
          <div className="p-5 rounded-3xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Sliders className="size-4 text-blue-500" />
                  {isAr ? "عنوان شريط الشركاء العام" : "Trusted By Section Header"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? "العنوان الرئيسي والفرعي المعروض فوق شعارات وأسماء الشركات"
                    : "Main uppercase label and subtitle displayed above the brand partner strip"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetSectionDefaults("partners")}
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
                >
                  <RotateCcw className="size-3 mr-1" />
                  {isAr ? "استعادة الافتراضي" : "Reset Default Title"}
                </Button>

                <Button
                  onClick={handleSaveSection}
                  disabled={savingSection}
                  size="sm"
                  className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                  {savingSection ? <RefreshCw className="size-3 animate-spin" /> : <Save className="size-3" />}
                  {isAr ? "حفظ العنوان" : "Save Header"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  {isAr ? "العنوان بالإنجليزية (English Title)" : "English Title *"}
                </Label>
                <Input
                  value={trustedSection.title_en}
                  onChange={(e) =>
                    setTrustedSection((prev) => ({ ...prev, title_en: e.target.value }))
                  }
                  placeholder="e.g. TRUSTED BY FORWARD-THINKING COMPANIES"
                  className="font-mono text-xs tracking-wider uppercase h-9"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  {isAr ? "العنوان بالعربية (Arabic Title)" : "Arabic Title *"}
                </Label>
                <Input
                  dir="rtl"
                  value={trustedSection.title_ar}
                  onChange={(e) =>
                    setTrustedSection((prev) => ({ ...prev, title_ar: e.target.value }))
                  }
                  placeholder="مثال: شركات رائدة تضع ثقتها في صدى"
                  className="font-arabic text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {isAr ? "النص الفرعي بالإنجليزية (اختياري)" : "English Subtitle (Optional)"}
                </Label>
                <Input
                  value={trustedSection.subtitle_en || ""}
                  onChange={(e) =>
                    setTrustedSection((prev) => ({ ...prev, subtitle_en: e.target.value }))
                  }
                  placeholder="e.g. Selected enterprise and boutique partners"
                  className="text-xs h-8"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  {isAr ? "النص الفرعي بالعربية (اختياري)" : "Arabic Subtitle (Optional)"}
                </Label>
                <Input
                  dir="rtl"
                  value={trustedSection.subtitle_ar || ""}
                  onChange={(e) =>
                    setTrustedSection((prev) => ({ ...prev, subtitle_ar: e.target.value }))
                  }
                  placeholder="مثال: نخبة من العلامات الرائدة"
                  className="font-arabic text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Partners Grid & Manager */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-blue-500" />
                  {isAr ? "قائمة شركاء النجاح والعلامات" : "Partner Brands & Clients"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr
                    ? "يدعم كل شريك إضافة اسم الشركة، رابط الموقع مع حالة التحويم (Hover)، والشعار كصورة أو نص فاخر"
                    : "Add partner name, logo (uploaded image or URL), click/hover link, and hover tooltip"}
                </p>
              </div>

              <Button
                onClick={handleOpenAddPartner}
                size="sm"
                className="rounded-xl text-xs gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Plus className="size-4" />
                {isAr ? "إضافة شريك جديد" : "Add Partner Brand"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {partners.map((partner, idx) => (
                <div
                  key={partner.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition shadow-xs hover:border-primary/50 ${
                    partner.is_active ? "border-border/80" : "border-border/40 opacity-60 bg-muted/20"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top status */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={partner.is_active ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0 rounded-md"
                        >
                          {partner.is_active ? (isAr ? "مفعّل" : "Active") : (isAr ? "مخفي" : "Hidden")}
                        </Badge>
                      </div>
                    </div>

                    {/* Logo Preview or Monogram Badge */}
                    <div className="h-20 w-full rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center p-2 overflow-hidden">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt={partner.name}
                          className="max-h-full max-w-full object-contain filter dark:brightness-110"
                        />
                      ) : (
                        <div className="text-center">
                          <span className="font-display font-bold text-sm tracking-wide text-foreground/85">
                            {partner.name}
                          </span>
                          <span className="block text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">
                            Text Logo Badge
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Partner Name & Link Info */}
                    <div>
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {partner.name}
                      </h4>

                      {partner.website_url ? (
                        <a
                          href={partner.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary dark:text-cyan-400 hover:underline mt-1 truncate max-w-full"
                        >
                          <Globe className="size-3 shrink-0" />
                          <span className="truncate">{partner.website_url.replace(/^https?:\/\//, "")}</span>
                          <ArrowUpRight className="size-2.5 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic mt-1 block">
                          No link configured
                        </span>
                      )}

                      {partner.hover_description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1 font-mono">
                          "{partner.hover_description}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPartnerToDelete(partner)}
                      className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2"
                    >
                      <Trash2 className="size-3 mr-1" />
                      {isAr ? "حذف" : "Delete"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditPartner(partner)}
                      className="h-7 text-xs rounded-lg gap-1 border-border/80"
                    >
                      <Edit2 className="size-3" />
                      {isAr ? "تعديل" : "Edit"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* EDIT / ADD PARTNER MODAL */}
          <Dialog open={partnerModalOpen} onOpenChange={setPartnerModalOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-blue-500" />
                  {editingPartner?.id
                    ? (isAr ? `تعديل الشريك: ${editingPartner.name}` : `Edit Partner: ${editingPartner.name}`)
                    : (isAr ? "إضافة شريك جديد" : "Add New Partner Brand")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isAr
                    ? "أدخل اسم الشريك ورابط الموقع ويمكنك رفع الشعار كصورة أو تركه كنص أنيق"
                    : "Configure brand name, upload a logo, and provide click and hover preview links."}
                </DialogDescription>
              </DialogHeader>

              {editingPartner && (
                <div className="space-y-4 py-2">
                  {/* Name */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block text-foreground">
                      {isAr ? "اسم الشركة / العلامة *" : "Partner Brand Name *"}
                    </Label>
                    <Input
                      value={editingPartner.name || ""}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g. Noor Coffee, Maven Studio, Atlas Realty"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Logo Options */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold block text-foreground">
                      {isAr ? "شعار الشريك (صورة أو رابط)" : "Partner Logo (Image Upload or Direct URL)"}
                    </Label>

                    <div className="flex gap-2">
                      <Input
                        value={editingPartner.logo_url || ""}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({ ...prev, logo_url: e.target.value }))
                        }
                        placeholder="https://... or upload below"
                        className="h-9 text-xs font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="rounded-xl shrink-0 h-9 text-xs gap-1.5"
                      >
                        {uploadingLogo ? (
                          <RefreshCw className="size-3.5 animate-spin text-primary" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        <span>{uploadingLogo ? "Uploading..." : (isAr ? "رفع صورة" : "Upload File")}</span>
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    {/* Logo Preview */}
                    {editingPartner.logo_url && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={editingPartner.logo_url}
                            alt="Logo preview"
                            className="size-10 object-contain rounded-md bg-white p-1"
                          />
                          <div>
                            <span className="text-xs font-medium text-foreground block">
                              Active Logo Preview
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-xs block">
                              {editingPartner.logo_url}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPartner((prev) => ({ ...prev, logo_url: "" }))}
                          className="h-7 text-xs text-rose-500 hover:text-rose-600"
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Website Link (Click URL) */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block text-foreground">
                      {isAr ? "رابط موقع الشريك (Click Link)" : "Website Click URL (External Link)"}
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        value={editingPartner.website_url || ""}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({ ...prev, website_url: e.target.value }))
                        }
                        placeholder="https://example.com"
                        className="h-9 text-xs font-mono pl-9"
                      />
                    </div>
                  </div>

                  {/* Hover Description Tooltip */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block text-foreground">
                      {isAr ? "وصف عند التمرير (Hover Tooltip Text)" : "Hover Tooltip Description"}
                    </Label>
                    <Input
                      value={editingPartner.hover_description || ""}
                      onChange={(e) =>
                        setEditingPartner((prev) => ({ ...prev, hover_description: e.target.value }))
                      }
                      placeholder="e.g. Specialty coffee roastery & digital ordering"
                      className="h-9 text-xs"
                    />
                  </div>

                  {/* Order & Active */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        {isAr ? "ترتيب الظهور" : "Sort Order"}
                      </Label>
                      <Input
                        type="number"
                        value={editingPartner.sort_order ?? 1}
                        onChange={(e) =>
                          setEditingPartner((prev) => ({
                            ...prev,
                            sort_order: Number(e.target.value),
                          }))
                        }
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Switch
                          id="partner-active-toggle"
                          checked={editingPartner.is_active ?? true}
                          onCheckedChange={(val) =>
                            setEditingPartner((prev) => ({ ...prev, is_active: val }))
                          }
                        />
                        <Label htmlFor="partner-active-toggle" className="text-xs cursor-pointer font-medium">
                          {editingPartner.is_active ? (isAr ? "مفعّل على الموقع" : "Active on Site") : (isAr ? "مخفي" : "Hidden")}
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPartnerModalOpen(false)}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSavePartnerModal}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isAr ? "حفظ الشريك" : "Save Partner"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: COMPANY PERFORMANCE KPIS (STATS BAR) */}
        {/* ======================================================== */}
        <TabsContent value="company_stats" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="size-4 text-emerald-500" />
                {isAr ? "أرقام وإحصائيات شريط الأداء (Stats Bar)" : "Company Performance KPIs (Stats Bar)"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? 'الأرقام الأربعة المعروضة في شريط الإنجازات: "120+ مشاريع منجزة"، "38M مشاهدات"، "96% استبقاء"، "24h سرعة الاستجابة"'
                  : 'Manage "120+ Projects shipped", "38M Views generated", "96% Client retention", "24h Avg. response time"'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetSectionDefaults("stats")}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <RotateCcw className="size-3 mr-1" />
                {isAr ? "استعادة الافتراضي" : "Reset Defaults"}
              </Button>
              <Button
                onClick={handleAddStatKpi}
                size="sm"
                className="rounded-xl text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="size-3.5" />
                {isAr ? "إضافة رقم أداء" : "Add Performance Stat"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {statsKpis.map((kpi, index) => (
              <div
                key={kpi.id}
                className={`relative flex flex-col justify-between rounded-3xl border bg-card p-5 transition-all shadow-xs ${
                  kpi.is_active ? "border-border/80" : "border-border/40 opacity-70 bg-muted/20"
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center size-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground truncate max-w-[120px]">
                        {kpi.metric_key}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Switch
                        id={`active-stat-${kpi.id}`}
                        checked={kpi.is_active}
                        onCheckedChange={(val) => handleStatChange(kpi.id, "is_active", val)}
                      />
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الأيقونة" : "Icon Picker"}
                        </Label>
                        <IconPicker
                          currentIcon={kpi.icon}
                          onSelect={(newIcon) => handleStatChange(kpi.id, "icon", newIcon)}
                          title={`Select Icon for ${kpi.label_en}`}
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الترتيب" : "Sort Order"}
                        </Label>
                        <Input
                          type="number"
                          value={kpi.sort_order}
                          onChange={(e) => handleStatChange(kpi.id, "sort_order", Number(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Numeric value + Suffix */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block font-semibold text-foreground">
                          {isAr ? "الرقم الأساسي" : "Number Value *"}
                        </Label>
                        <Input
                          type="number"
                          value={kpi.value}
                          onChange={(e) => handleStatChange(kpi.id, "value", Number(e.target.value))}
                          className="h-9 text-base font-bold font-mono text-primary dark:text-cyan-400"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block font-semibold text-foreground">
                          {isAr ? "اللاحقة (+, M, %, h)" : "Suffix (+, M, %, h)"}
                        </Label>
                        <Input
                          placeholder="+, M, %, h"
                          value={kpi.suffix || ""}
                          onChange={(e) => handleStatChange(kpi.id, "suffix", e.target.value)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                    </div>

                    {/* Bilingual labels */}
                    <div className="space-y-2 pt-1">
                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الوصف بالإنجليزية (EN)" : "English Label *"}
                        </Label>
                        <Input
                          value={kpi.label_en}
                          onChange={(e) => handleStatChange(kpi.id, "label_en", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="e.g. Projects shipped"
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          {isAr ? "الوصف بالعربية (AR)" : "Arabic Label *"}
                        </Label>
                        <Input
                          dir="rtl"
                          value={kpi.label_ar}
                          onChange={(e) => handleStatChange(kpi.id, "label_ar", e.target.value)}
                          className="h-8 text-xs font-arabic"
                          placeholder="مثال: مشروعاً منجزاً"
                        />
                      </div>
                    </div>

                    {/* Live preview in Stats card format */}
                    <div className="pt-2">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5 block">
                        {isAr ? "معاينة شريط الأداء" : "Stats Bar Preview"}
                      </Label>
                      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80">
                        <div className="flex items-center gap-2">
                          {kpi.icon && (
                            <span className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-cyan-400">
                              <DynamicIcon name={kpi.icon} className="size-4" />
                            </span>
                          )}
                          <div className="text-2xl font-display font-bold text-foreground tabular-nums">
                            {kpi.prefix && <span>{kpi.prefix}</span>}
                            <span>{kpi.value}</span>
                            <span className="text-primary dark:text-cyan-400">{kpi.suffix}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 font-medium">
                          {kpi.label_en} • <span className="font-arabic">{kpi.label_ar}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Save / Delete */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKpiToDelete(kpi)}
                    className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 px-2"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    {isAr ? "حذف" : "Delete"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleSaveStatKpi(kpi)}
                    disabled={savingStatId === kpi.id}
                    className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  >
                    {savingStatId === kpi.id ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                    {isAr ? "حفظ التغييرات" : "Save Changes"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 4: INTERACTIVE LIVE PUBLIC PREVIEW */}
        {/* ======================================================== */}
        <TabsContent value="preview" className="mt-6 space-y-8">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Eye className="size-4 text-purple-500" />
                {isAr ? "المعاينة التفاعلية لمكونات الموقع" : "Simulated Public Website Display"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "تحقق من شكل المؤشرات والشركاء والأيقونات باللغتين العربية والإنجليزية وفي الوضعين الليلي والنهاري"
                  : "Preview your changes exactly as visitors will see them on the landing page"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Language toggle */}
              <div className="flex items-center rounded-xl bg-muted p-1 border border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewLang("en")}
                  className={`px-2.5 py-1 rounded-lg transition font-medium ${
                    previewLang === "en" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang("ar")}
                  className={`px-2.5 py-1 rounded-lg transition font-medium font-arabic ${
                    previewLang === "ar" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  العربية
                </button>
              </div>

              {/* Theme toggle */}
              <div className="flex items-center rounded-xl bg-muted p-1 border border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewTheme("dark")}
                  className={`px-2.5 py-1 rounded-lg transition font-medium ${
                    previewTheme === "dark" ? "bg-zinc-950 text-white shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Dark Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTheme("light")}
                  className={`px-2.5 py-1 rounded-lg transition font-medium ${
                    previewTheme === "light" ? "bg-white text-zinc-900 shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  Light Canvas
                </button>
              </div>
            </div>
          </div>

          {/* SIMULATED VIEWPORT CONTAINER */}
          <div
            className={`rounded-3xl border p-6 md:p-10 transition-colors duration-200 ${
              previewTheme === "dark"
                ? "bg-zinc-950 text-white border-zinc-800"
                : "bg-zinc-50 text-zinc-900 border-zinc-200"
            }`}
            dir={previewLang === "ar" ? "rtl" : "ltr"}
          >
            {/* 1. Hero Proof Simulation */}
            <div className="mb-12">
              <div className="text-[11px] font-mono tracking-wider uppercase opacity-60 mb-3">
                [SECTION 1: HERO PROOF CHIPS]
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {heroKpis
                  .filter((k) => k.is_active)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition ${
                        previewTheme === "dark"
                          ? "bg-white/5 border-white/10 hover:border-white/20"
                          : "bg-white border-zinc-200 shadow-sm"
                      }`}
                    >
                      <span className="p-2 rounded-xl bg-primary/10 text-primary dark:text-cyan-400">
                        <DynamicIcon name={item.icon} className="size-4" />
                      </span>
                      <div className="leading-tight">
                        <div className="text-sm font-bold tracking-tight">
                          {item.prefix && <span>{item.prefix}</span>}
                          <span>{item.value}</span>
                          <span className="text-primary dark:text-cyan-400">{item.suffix}</span>
                        </div>
                        <div className="text-[11px] opacity-75 font-medium">
                          {previewLang === "ar" ? item.label_ar : item.label_en}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 2. Trusted By Section Simulation */}
            <div className="mb-12 pt-8 border-t border-border/40">
              <div className="text-[11px] font-mono tracking-wider uppercase opacity-60 mb-4">
                [SECTION 2: TRUSTED BY FORWARD-THINKING COMPANIES]
              </div>

              <div className="text-center space-y-1 mb-8">
                <p className="text-xs uppercase tracking-[0.25em] font-medium opacity-70">
                  {previewLang === "ar" ? trustedSection.title_ar : trustedSection.title_en}
                </p>
                {(previewLang === "ar" ? trustedSection.subtitle_ar : trustedSection.subtitle_en) && (
                  <p className="text-xs opacity-60">
                    {previewLang === "ar" ? trustedSection.subtitle_ar : trustedSection.subtitle_en}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {partners
                  .filter((p) => p.is_active)
                  .map((partner) => {
                    const content = (
                      <div className="group/item flex items-center gap-2 cursor-pointer transition hover:opacity-100 opacity-75">
                        {partner.logo_url ? (
                          <img
                            src={partner.logo_url}
                            alt={partner.name}
                            className="h-6 md:h-8 max-w-[120px] object-contain filter grayscale group-hover/item:grayscale-0 transition"
                          />
                        ) : (
                          <span className="font-display text-sm md:text-base font-semibold tracking-wide">
                            {partner.name}
                          </span>
                        )}
                        {partner.website_url && (
                          <ArrowUpRight className="size-3 opacity-0 group-hover/item:opacity-100 transition" />
                        )}
                      </div>
                    );

                    return (
                      <TooltipProvider key={partner.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {partner.website_url ? (
                              <a
                                href={partner.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="focus:outline-none"
                              >
                                {content}
                              </a>
                            ) : (
                              <div>{content}</div>
                            )}
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <p className="font-semibold">{partner.name}</p>
                            {partner.hover_description && (
                              <p className="text-[11px] text-muted-foreground">{partner.hover_description}</p>
                            )}
                            {partner.website_url && (
                              <p className="text-[10px] text-primary underline mt-0.5">{partner.website_url}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
              </div>
            </div>

            {/* 3. Performance Stats Bar Simulation */}
            <div className="pt-8 border-t border-border/40">
              <div className="text-[11px] font-mono tracking-wider uppercase opacity-60 mb-4">
                [SECTION 3: COMPANY PERFORMANCE KPIS BAR]
              </div>

              <div
                className={`rounded-3xl border p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-6 ${
                  previewTheme === "dark"
                    ? "bg-zinc-900/60 border-zinc-800"
                    : "bg-white border-zinc-200 shadow-sm"
                }`}
              >
                {statsKpis
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <div key={s.id} className="text-center md:text-start flex flex-col md:items-start items-center">
                      <div className="flex items-center gap-2">
                        {s.icon && (
                          <span className="p-1.5 rounded-lg bg-primary/10 text-primary dark:text-cyan-400">
                            <DynamicIcon name={s.icon} className="size-4" />
                          </span>
                        )}
                        <div className="text-3xl md:text-4xl font-display font-bold tabular-nums">
                          {s.prefix && <span>{s.prefix}</span>}
                          <span>{s.value}</span>
                          <span className="text-primary dark:text-cyan-400">{s.suffix}</span>
                        </div>
                      </div>
                      <div className="text-xs md:text-sm opacity-75 mt-1 font-medium">
                        {previewLang === "ar" ? s.label_ar : s.label_en}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* KPI DELETE ALERT DIALOG */}
      <AlertDialog open={!!kpiToDelete} onOpenChange={(open) => !open && setKpiToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="size-5" />
              {isAr ? "تأكيد حذف المؤشر" : "Confirm Metric Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {isAr
                ? `هل أنت متأكد من رغبتك في حذف المؤشر "${kpiToDelete?.label_ar || kpiToDelete?.label_en}" نهائياً من الموقع؟`
                : `Are you sure you want to permanently delete metric "${kpiToDelete?.label_en}"? It will be removed from public landing pages.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKpiConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isAr ? "نعم، حذف المؤشر" : "Yes, Delete Metric"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PARTNER DELETE ALERT DIALOG */}
      <AlertDialog open={!!partnerToDelete} onOpenChange={(open) => !open && setPartnerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <AlertCircle className="size-5" />
              {isAr ? "تأكيد حذف الشريك" : "Confirm Partner Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {isAr
                ? `هل أنت متأكد من رغبتك في حذف الشريك "${partnerToDelete?.name}" من قائمة الشركاء؟`
                : `Are you sure you want to remove "${partnerToDelete?.name}" from your trusted brand partners list?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePartnerConfirm}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isAr ? "نعم، حذف الشريك" : "Yes, Remove Partner"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
