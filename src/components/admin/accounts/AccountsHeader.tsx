import { Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { SADASelect } from "@/components/ui/sada-select";
import { SADASearch } from "@/components/ui/sada-search";
import { SADAButton } from "@/components/ui/sada-button";
import { useTranslation } from "@/i18n";

interface AccountsHeaderProps {
  search: string;
  onSearchChange: (val: string) => void;
  roleFilter: string;
  onRoleFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  divisionFilter: string;
  onDivisionFilterChange: (val: string) => void;
  sortBy: string;
  onSortByChange: (val: string) => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  canCreate: boolean;
}

export function AccountsHeader({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  divisionFilter,
  onDivisionFilterChange,
  sortBy,
  onSortByChange,
  onOpenCreate,
  onRefresh,
  refreshing,
  canCreate,
}: AccountsHeaderProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const roleOptions = [
    { value: "all", label: isAr ? "جميع الأدوار" : "All Roles" },
    { value: "super_admin", label: isAr ? "مشرف متميز (Super Admin)" : "Super Admin" },
    { value: "admin", label: isAr ? "مدير نظام (Admin)" : "Admin" },
    { value: "worker", label: isAr ? "عضو فريق (Worker)" : "Worker" },
  ];

  const statusOptions = [
    { value: "all", label: isAr ? "جميع الحالات" : "All Statuses" },
    { value: "active", label: isAr ? "نشط" : "Active" },
    { value: "suspended", label: isAr ? "معلق" : "Suspended" },
    { value: "pending", label: isAr ? "قيد الانتظار" : "Pending" },
    { value: "disabled", label: isAr ? "معطل" : "Disabled" },
  ];

  const divisionOptions = [
    { value: "all", label: isAr ? "جميع الأقسام" : "All Divisions" },
    { value: "Executive", label: isAr ? "الإدارة التنفيذية" : "Executive" },
    { value: "Development", label: isAr ? "التطوير البرمجي" : "Development" },
    { value: "Marketing", label: isAr ? "التسويق" : "Marketing" },
    { value: "Production", label: isAr ? "الإنتاج" : "Production" },
    { value: "Design", label: isAr ? "التصميم" : "Design" },
  ];

  const sortOptions = [
    { value: "newest", label: isAr ? "الأحدث أولاً" : "Newest First" },
    { value: "oldest", label: isAr ? "الأقدم أولاً" : "Oldest First" },
    { value: "last_login", label: isAr ? "آخر تسجيل دخول" : "Recent Sign In" },
    { value: "name_asc", label: isAr ? "الاسم (أ - ي)" : "Name (A-Z)" },
    { value: "role", label: isAr ? "مستوى الصلاحية" : "Privilege Level" },
  ];

  const hasActiveFilters =
    search || roleFilter !== "all" || statusFilter !== "all" || divisionFilter !== "all" || sortBy !== "newest";

  const clearFilters = () => {
    onSearchChange("");
    onRoleFilterChange("all");
    onStatusFilterChange("all");
    onDivisionFilterChange("all");
    onSortByChange("newest");
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 grid place-items-center shadow-sm">
              <ShieldCheck className="size-4" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {isAr ? "إدارة الحسابات" : "ACCOUNT MANAGEMENT"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {isAr
              ? "إدارة الوصول إلى صدى، وتوزيع الأدوار والصلاحيات، ومتابعة حالات الحسابات وبيانات الهوية."
              : "Manage who can access SADA, their roles, account status, and identity information."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <SADAButton
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-xl"
            title={isAr ? "تحديث قائمة الحسابات" : "Refresh accounts"}
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
          </SADAButton>

          {canCreate && (
            <SADAButton
              type="button"
              variant="primary"
              onClick={onOpenCreate}
              className="rounded-xl shadow-md text-xs font-semibold"
            >
              <Plus className="size-4" />
              <span>{isAr ? "إنشاء حساب" : "Create Account"}</span>
            </SADAButton>
          )}
        </div>
      </div>

      {/* Filter and Search Ribbon */}
      <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input using SADA Search */}
        <div className="flex-1 min-w-[200px]">
          <SADASearch
            placeholder={isAr ? "البحث عن حساب بالاسم أو البريد الإلكتروني..." : "Search account by name or email..."}
            value={search}
            onChange={(val) => onSearchChange(val)}
            size="compact"
          />
        </div>

        {/* Dropdown Filters using SADA Select */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[140px]">
            <SADASelect
              value={roleFilter}
              onChange={onRoleFilterChange}
              options={roleOptions}
              placeholder={isAr ? "الدور" : "Role"}
            />
          </div>

          <div className="w-[130px]">
            <SADASelect
              value={statusFilter}
              onChange={onStatusFilterChange}
              options={statusOptions}
              placeholder={isAr ? "الحالة" : "Status"}
            />
          </div>

          <div className="w-[145px]">
            <SADASelect
              value={divisionFilter}
              onChange={onDivisionFilterChange}
              options={divisionOptions}
              placeholder={isAr ? "القسم" : "Division"}
            />
          </div>

          <div className="w-[155px]">
            <SADASelect
              value={sortBy}
              onChange={onSortByChange}
              options={sortOptions}
              placeholder={isAr ? "الترتيب حسب" : "Sort by"}
            />
          </div>

          {hasActiveFilters && (
            <SADAButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              {isAr ? "إعادة تعيين" : "Reset"}
            </SADAButton>
          )}
        </div>
      </div>
    </div>
  );
}
