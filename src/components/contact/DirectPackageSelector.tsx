// ============================================================
// SADA OS — SMART MATCHER: DIRECT PACKAGE SELECTOR
// Public catalog direct selection (is_active = true && is_published = true)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Check, ArrowRight, ArrowLeft, Layers, ShieldCheck } from "lucide-react";
import { SADAButton, SADASearch, SADABadge, SADACard } from "@/components/ui/sada-ui";
import { SADANumber } from "@/components/ui/sada-number";
import { useTranslation } from "@/i18n";
import { fetchDirectPublicPackages } from "@/lib/smart-match-service";
import type { PackageCatalogItem } from "@/types/package-catalog";
import type { PackageRecommendation } from "@/types/smart-match";

interface DirectPackageSelectorProps {
  initialPackageId?: string;
  onSelectPackage: (rec: PackageRecommendation) => void;
  onBackToSelection: () => void;
}

export function DirectPackageSelector({
  initialPackageId,
  onSelectPackage,
  onBackToSelection,
}: DirectPackageSelectorProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  const [packages, setPackages] = useState<PackageCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chosenPkg, setChosenPkg] = useState<PackageCatalogItem | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchDirectPublicPackages();
      setPackages(data);

      if (initialPackageId) {
        const q = initialPackageId.trim().toLowerCase();
        const found = data.find(
          (p) =>
            p.id === initialPackageId ||
            p.code.toLowerCase() === q ||
            p.slug.toLowerCase() === q
        );
        if (found) setChosenPkg(found);
      }
      setLoading(false);
    }
    load();
  }, [initialPackageId]);

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    packages.forEach((p) => {
      if (p.category_name) cats.add(p.category_name);
    });
    return Array.from(cats);
  }, [packages]);

  // Filtered packages
  const filtered = useMemo(() => {
    return packages.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(q) ||
        (p.name_ar && p.name_ar.toLowerCase().includes(q)) ||
        (p.short_description && p.short_description.toLowerCase().includes(q)) ||
        p.code.toLowerCase().includes(q);

      const matchesCat = selectedCategory === "all" || p.category_name === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [packages, search, selectedCategory]);

  const handleConfirm = () => {
    if (!chosenPkg) return;

    const rec: PackageRecommendation = {
      packageId: chosenPkg.id,
      packageCode: chosenPkg.code,
      packageName: chosenPkg.name,
      packageNameAr: chosenPkg.name_ar,
      packagePrice: chosenPkg.price,
      currency: chosenPkg.currency || "TND",
      billingType: chosenPkg.billing_type || "monthly",
      score: 100,
      matchLevel: "strong",
      breakdown: {
        objective: 30,
        services: 25,
        budget: 15,
        businessType: 10,
        stage: 10,
        growthLevel: 5,
        capacity: 5,
        totalScore: 100,
        serviceMatch: 25,
        goalMatch: 20,
        contentMatch: 15,
        advertisingMatch: 10,
        websiteMatch: 10,
        budgetMatch: 10,
        businessTypeMatch: 5,
        businessStageMatch: 5,
      },
      reasons: [
        {
          id: "direct_choice",
          category: "general",
          text: "Selected directly by client from public catalog.",
          textAr: "تم اختيار الباقة مباشرة من قبل العميل من الكتالوج العام.",
        },
      ],
      isUnpublished: false,
      packageItem: chosenPkg,
    };

    onSelectPackage(rec);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground">
            {isAr ? "اختر باقتك من الكتالوج العام" : "Choose your SADA Package"}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isAr
              ? "تصفح جميع الباقات النشطة واختر الخيار الأنسب لأهدافك."
              : "Browse verified active packages and select the exact scope you need."}
          </p>
        </div>

        <SADAButton variant="outline" onClick={onBackToSelection} className="gap-2 self-start sm:self-auto shrink-0 whitespace-nowrap min-h-[40px] px-4">
          <ArrowLeft className="size-4 rtl:rotate-180 shrink-0" />
          <span className="whitespace-nowrap">{isAr ? "رجوع للخيارات" : "All Entry Options"}</span>
        </SADAButton>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <SADASearch
          placeholder={isAr ? "ابحث بالاسم أو الرمز (مثال: Growth, WEB-02)..." : "Search packages by name or code..."}
          value={search}
          onChange={(val) => setSearch(val)}
          onClear={() => setSearch("")}
        />

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {isAr ? "جميع التصنيفات" : "All Categories"} ({packages.length})
            </button>
            {categories.map((cat) => {
              const count = packages.filter((p) => p.category_name === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Package Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground">
            {isAr ? "جاري تحميل الباقات..." : "Loading catalog packages..."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">
            {isAr ? "لم نجد باقة تطابق بحثك." : "No packages match your search query."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((pkg) => {
            const isSelected = chosenPkg?.id === pkg.id;
            return (
              <div
                key={pkg.id}
                onClick={() => setChosenPkg(pkg)}
                className={`cursor-pointer rounded-2xl p-5 border transition-all text-start flex flex-col justify-between gap-4 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {pkg.code}
                    </span>
                    {pkg.badge && (
                      <SADABadge variant="primary" className="text-[10px] uppercase font-bold tracking-wider">
                        {pkg.badge.replace("_", " ")}
                      </SADABadge>
                    )}
                  </div>

                  <div>
                    <h4 className="text-lg font-bold font-display text-foreground">
                      {isAr ? (pkg.name_ar || pkg.name) : pkg.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {isAr ? (pkg.short_description_ar || pkg.short_description) : (pkg.short_description || pkg.description)}
                    </p>
                  </div>

                  {pkg.included_items && pkg.included_items.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      {pkg.included_items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-foreground/80">
                          <Check className="size-3 text-primary shrink-0 stroke-[3]" />
                          <span className="truncate">{isAr ? (item.text_ar || item.text) : item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    {pkg.price > 0 ? (
                      <div className="flex items-baseline gap-1">
                        <SADANumber
                          variant="kpi"
                          value={pkg.price}
                          currency={pkg.currency || "TND"}
                          className="text-xl text-foreground font-bold tracking-tight"
                        />
                        <span className="text-xs font-normal text-muted-foreground font-sans">
                          / {pkg.billing_type === "monthly" ? (isAr ? "شهرياً" : "mo") : (isAr ? "مرة واحدة" : "one-time")}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-primary">
                        {isAr ? "حسب الطلب" : "Custom Scope"}
                      </div>
                    )}
                  </div>

                  <div
                    className={`size-6 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/30 bg-muted/20"
                    }`}
                  >
                    {isSelected && <Check className="size-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky or Bottom Action Bar */}
      {chosenPkg && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky bottom-4 p-4 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 z-20"
        >
          <div className="text-start space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {isAr ? "الباقة المختارة:" : "Selected Package:"}
            </span>
            <div className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
              <span>{isAr ? (chosenPkg.name_ar || chosenPkg.name) : chosenPkg.name}</span>
              {chosenPkg.price > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({chosenPkg.price} {chosenPkg.currency})
                </span>
              )}
            </div>
          </div>

          <SADAButton variant="primary" onClick={handleConfirm} className="w-full sm:w-auto gap-2 font-semibold shrink-0 whitespace-nowrap min-h-[44px] px-6">
            <span className="whitespace-nowrap">{isAr ? "متابعة لتفاصيل التواصل" : "Continue to Contact Details"}</span>
            <ArrowRight className="size-4 rtl:rotate-180 shrink-0" />
          </SADAButton>
        </motion.div>
      )}
    </div>
  );
}
