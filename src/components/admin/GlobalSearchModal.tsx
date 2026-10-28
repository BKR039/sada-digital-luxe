import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  Building2,
  Briefcase,
  CheckSquare,
  Users,
  FileText,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  CornerDownLeft,
  Zap,
  Target,
  Package,
  PlusCircle,
  BarChart3,
  Landmark,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SearchResultItem {
  id: string;
  category: "quick_action" | "deal" | "package" | "client" | "project" | "task" | "team_member" | "invoice" | "transaction";
  title: string;
  subtitle: string;
  url: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { isSuperAdmin, isAdmin, canAccessModule } = useAuth();
  const { t, isRTL } = useTranslation();
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAccessFinancials = isSuperAdmin || isAdmin || canAccessModule("finance");
  const canAccessAnalytics = isSuperAdmin || isAdmin || canAccessModule("analytics");

  // Canonical Quick Actions for instant 1-click execution (Reduces clicks across SADA OS)
  const defaultQuickActions: SearchResultItem[] = useMemo(() => {
    const list: SearchResultItem[] = [
      {
        id: "qa-deals",
        category: "quick_action",
        title: isRTL ? "الانتقال إلى الصفقات والمبيعات" : "Go to Sales Pipeline",
        subtitle: isRTL ? "متابعة صفقات المبيعات وعروض الأسعار" : "Deals Kanban, Qualification & Pipeline",
        url: "/admin/sales",
      },
      {
        id: "qa-packages",
        category: "quick_action",
        title: isRTL ? "الانتقال إلى باقات وأسعار سادا" : "Go to Package Catalog",
        subtitle: isRTL ? "إدارة باقات الخدمات والأسعار الرسمية" : "Master Package Catalog & CMS Pricing",
        url: "/admin/packages",
      },
      {
        id: "qa-clients",
        category: "quick_action",
        title: isRTL ? "الانتقال إلى مساحات العملاء" : "Go to Client Workspaces",
        subtitle: isRTL ? "إدارة مساحات وسجلات العملاء والحسابات النشطة" : "Active accounts, deliverables & contacts",
        url: "/admin/client-workspaces",
      },
      {
        id: "qa-my-work",
        category: "quick_action",
        title: isRTL ? "الانتقال إلى مهامي اليومية" : "Go to My Work Execution",
        subtitle: isRTL ? "سجل المهام، المتتبع الزمني، والتسليمات" : "Stopwatch timer, task buckets & deliverables",
        url: "/admin/my-work",
      },
      {
        id: "qa-create-deal",
        category: "quick_action",
        title: isRTL ? "تسجيل صفقة مبيعات جديدة" : "Create Sales Deal",
        subtitle: isRTL ? "تسجيل فرصة بيعية جديدة في القمع" : "Open new prospect pipeline modal",
        url: "/admin/sales",
      },
      {
        id: "qa-create-package",
        category: "quick_action",
        title: isRTL ? "إضافة باقة جديدة للكتالوج" : "Create Package",
        subtitle: isRTL ? "إنشاء باقة خدمات جديدة بالأسعار والميزات" : "Open package catalog builder drawer",
        url: "/admin/packages",
      },
      {
        id: "qa-create-client",
        category: "quick_action",
        title: isRTL ? "تسجيل عميل جديد" : "Create Client",
        subtitle: isRTL ? "فتح ملف عميل جديد وربط الباقة" : "Register new client account in CRM",
        url: "/admin/client-workspaces",
      },
    ];

    if (canAccessFinancials) {
      list.splice(3, 0, {
        id: "qa-finance",
        category: "quick_action",
        title: isRTL ? "مركز القيادة المالية" : "Go to Financial Command Center",
        subtitle: isRTL ? "الفواتير، المصاريف، الإيرادات، والإغلاق المالي" : "Invoices, Expenses, Payroll & Closing",
        url: "/admin/finance",
      });
    }

    if (canAccessAnalytics) {
      list.splice(canAccessFinancials ? 4 : 3, 0, {
        id: "qa-analytics",
        category: "quick_action",
        title: isRTL ? "مؤشرات الأداء والتحليلات" : "Go to Analytics & KPIs",
        subtitle: isRTL ? "الربحية، هامش الربح، وإنتاجية الفريق" : "Executive command metrics, profit & margins",
        url: "/admin/analytics",
      });
    }

    return list;
  }, [isRTL, canAccessFinancials, canAccessAnalytics]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(defaultQuickActions);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultQuickActions]);

  // Execute Search query across canonical tables with strict RBAC isolation
  useEffect(() => {
    if (!query.trim()) {
      setResults(defaultQuickActions);
      setLoading(false);
      return;
    }

    const q = query.trim().toLowerCase();
    let isCancelled = false;
    setLoading(true);

    const performSearch = async () => {
      try {
        // Filter matching quick actions
        const matchedQuickActions = defaultQuickActions.filter(
          (qa) =>
            qa.title.toLowerCase().includes(q) ||
            qa.subtitle.toLowerCase().includes(q)
        );

        const promises: Promise<any>[] = [
          // 1. Packages (Package Catalog & Packages)
          (supabase as any)
            .from("package_catalog")
            .select("id, name, package_code, selling_price, status")
            .or(`name.ilike.%${q}%,package_code.ilike.%${q}%`)
            .limit(5),

          // 2. Deals (Sales Pipeline)
          (supabase as any)
            .from("deals")
            .select("id, title, company_name, deal_value, stage")
            .or(`company_name.ilike.%${q}%,title.ilike.%${q}%`)
            .limit(5),

          // 3. Clients
          (supabase as any)
            .from("clients")
            .select("id, name, industry, status")
            .ilike("name", `%${q}%`)
            .limit(5),

          // 4. Client Projects
          (supabase as any)
            .from("client_projects")
            .select("id, title, client:clients(name)")
            .ilike("title", `%${q}%`)
            .limit(5),

          // 5. Tasks
          (supabase as any)
            .from("project_tasks")
            .select("id, title, category, status, client:clients(name)")
            .ilike("title", `%${q}%`)
            .limit(6),

          // 6. Team Members
          (supabase as any)
            .from("team_members")
            .select("id, name, position, division")
            .ilike("name", `%${q}%`)
            .limit(4),
        ];

        // 7. Invoices (Admins & Super Admin only)
        if (canAccessFinancials) {
          promises.push(
            (supabase as any)
              .from("invoices")
              .select("id, invoice_number, total_amount, status, client:clients(name)")
              .ilike("invoice_number", `%${q}%`)
              .limit(4)
          );
        }

        // 8. Transactions (Super Admin only)
        if (isSuperAdmin) {
          promises.push(
            (supabase as any)
              .from("income_transactions")
              .select("id, description, amount, category")
              .ilike("description", `%${q}%`)
              .limit(3)
          );
        }

        const responses = await Promise.all(promises);
        if (isCancelled) return;

        const [packagesRes, dealsRes, clientsRes, projectsRes, tasksRes, teamRes, invRes, transRes] = responses;
        const items: SearchResultItem[] = [...matchedQuickActions];

        // Map Packages
        for (const p of packagesRes.data || []) {
          items.push({
            id: p.id,
            category: "package",
            title: p.name,
            subtitle: `${p.package_code || "Package"} · ${p.selling_price ? formatCurrency(p.selling_price) : "Custom"} (${p.status || "Active"})`,
            url: `/admin/packages`,
          });
        }

        // Map Deals
        for (const d of dealsRes.data || []) {
          items.push({
            id: d.id,
            category: "deal",
            title: d.company_name || d.title,
            subtitle: `Deal · ${d.title} · ${formatCurrency(d.deal_value || 0)} (${d.stage})`,
            url: `/admin/sales`,
          });
        }

        // Map Clients
        for (const c of clientsRes.data || []) {
          items.push({
            id: c.id,
            category: "client",
            title: c.name,
            subtitle: `${c.industry || "Client"} · ${c.status || "active"}`,
            url: `/admin/client-workspaces/${c.id}`,
          });
        }

        // Map Projects
        for (const p of projectsRes.data || []) {
          items.push({
            id: p.id,
            category: "project",
            title: p.title,
            subtitle: `Workspace · ${p.client?.name || "Client"}`,
            url: (p as any).client_id ? `/admin/client-workspaces/${(p as any).client_id}` : `/admin/client-workspaces/${p.id}`,
          });
        }

        // Map Tasks
        for (const t of tasksRes.data || []) {
          items.push({
            id: t.id,
            category: "task",
            title: t.title,
            subtitle: `${t.category || "Task"} · ${t.client?.name || "Client"} (${t.status})`,
            url: `/admin/my-work`,
          });
        }

        // Map Team Members
        for (const m of teamRes.data || []) {
          items.push({
            id: m.id,
            category: "team_member",
            title: m.name,
            subtitle: `${m.position || "Specialist"} · ${m.division || "Operations"}`,
            url: `/admin/team-workload`,
          });
        }

        // Map Invoices (Admins & Super Admin only)
        if (canAccessFinancials && invRes?.data) {
          for (const inv of invRes.data) {
            items.push({
              id: inv.id,
              category: "invoice",
              title: inv.invoice_number,
              subtitle: `Invoice · ${inv.client?.name || "Client"} · ${inv.total_amount} TND (${inv.status})`,
              url: `/admin/finance`,
            });
          }
        }

        // Map Transactions (Super Admin only)
        if (isSuperAdmin && transRes?.data) {
          for (const tr of transRes.data) {
            items.push({
              id: tr.id,
              category: "transaction",
              title: tr.description,
              subtitle: `Transaction · ${tr.category} · ${tr.amount} TND`,
              url: `/admin/finance`,
            });
          }
        }

        setResults(items);
        setSelectedIndex(0);
      } catch (err) {
        console.error("[GlobalSearch] Search failed:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, canAccessFinancials, isSuperAdmin, defaultQuickActions]);

  // Navigate to selected result
  const handleSelect = (item: SearchResultItem) => {
    onClose();
    nav({ to: item.url as any });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const getCategoryBadge = (cat: SearchResultItem["category"]) => {
    switch (cat) {
      case "quick_action":
        return { label: isRTL ? "إجراء سريع" : "Quick Action", icon: Zap, color: "bg-primary/10 text-primary border-primary/20" };
      case "deal":
        return { label: isRTL ? "صفقة" : "Deal", icon: Target, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
      case "package":
        return { label: isRTL ? "باقة" : "Package", icon: Package, color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" };
      case "client":
        return { label: isRTL ? "عميل" : "Client", icon: Building2, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "project":
        return { label: isRTL ? "مساحة عمل" : "Workspace", icon: Briefcase, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      case "task":
        return { label: isRTL ? "مهمة" : "Task", icon: CheckSquare, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
      case "team_member":
        return { label: isRTL ? "فريق" : "Team", icon: Users, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" };
      case "invoice":
        return { label: isRTL ? "فاتورة" : "Invoice", icon: FileText, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
      case "transaction":
        return { label: isRTL ? "سجل مالي" : "Ledger", icon: DollarSign, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Global Search & Command Menu</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
          <Search className="size-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRTL
                ? "ابحث عن باقات، صفقات، عملاء، فواتير، أو اختصارات سريعة..."
                : "Search packages, deals, clients, invoices, or quick actions..."
            }
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {loading && <Loader2 className="size-4 animate-spin text-primary shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-border bg-muted text-muted-foreground hidden sm:inline-block">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length >= 2 && results.length === 0 && !loading && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {isRTL ? "لا توجد نتائج تطابق بحثك." : "No results match your search query."}
            </div>
          )}

          {results.map((item, idx) => {
            const badge = getCategoryBadge(item.category);
            const Icon = badge.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={`${item.category}-${item.id}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-start transition-all ${
                  isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl border shrink-0 ${badge.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ps-3">
                  <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                    {badge.label}
                  </span>
                  {isSelected && (
                    <CornerDownLeft className="size-3.5 text-primary hidden sm:inline-block" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>{isRTL ? "↑↓ للتنقل" : "↑↓ Navigate"}</span>
            <span>{isRTL ? "↵ للاختيار" : "↵ Select"}</span>
            <span>{isRTL ? "ESC للإغلاق" : "ESC Close"}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">
            {canAccessFinancials
              ? (isRTL ? "نطاق تنفيذي شامل" : "Executive Scope")
              : (isRTL ? "نطاق تشغيلي" : "Operations Scope")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
