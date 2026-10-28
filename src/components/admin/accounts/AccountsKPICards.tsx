import { AccountKPIs } from "@/lib/account-service";
import { Users, UserCheck, UserX, Crown, Shield, HardHat } from "lucide-react";
import { useTranslation } from "@/i18n";

interface AccountsKPICardsProps {
  kpis: AccountKPIs;
}

export function AccountsKPICards({ kpis }: AccountsKPICardsProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. TOTAL ACCOUNTS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "إجمالي الحسابات" : "Total Accounts"}
          </span>
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Users className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.totalAccounts}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "هويات مصادقة مسجلة" : "Auth identities on file"}
        </div>
      </div>

      {/* 2. ACTIVE ACCOUNTS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "نشطة" : "Active"}
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <UserCheck className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.activeCount}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "تتمتع بالوصول للنظام" : "Can access SADA OS"}
        </div>
      </div>

      {/* 3. SUSPENDED ACCOUNTS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "معلقة" : "Suspended"}
          </span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <UserX className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-rose-500 tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.suspendedCount}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "الوصول معطل حالياً" : "Access locked"}
        </div>
      </div>

      {/* 4. SUPER ADMINS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "مشرف متميز" : "Super Admins"}
          </span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Crown className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-purple-600 dark:text-purple-400 tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.superAdminCount}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "تحكم جذري كامل" : "Full root control"}
        </div>
      </div>

      {/* 5. ADMINS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "مديرو نظام" : "Admins"}
          </span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Shield className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-blue-600 dark:text-blue-400 tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.adminCount}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "إشراف تشغيلي وفريق" : "Ops & team oversight"}
        </div>
      </div>

      {/* 6. WORKERS */}
      <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-border transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {isAr ? "أعضاء الفريق" : "Workers"}
          </span>
          <div className="p-1.5 rounded-lg bg-muted text-muted-foreground border border-border">
            <HardHat className="size-3.5" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight tabular-nums sada-num-kpi" dir="ltr">
            {kpis.workerCount}
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">
          {isAr ? "التنفيذ والمهام" : "Execution & tasks"}
        </div>
      </div>
    </div>
  );
}
