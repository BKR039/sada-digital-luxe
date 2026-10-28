import React, { useState, useMemo } from "react";
import { formatCurrency } from "@/types/finance";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, PieChart, Layers, Building2, UserCheck } from "lucide-react";

interface ExpenseBreakdownViewProps {
  rawLedger: any[];
  totalExpenses: number;
  onOpenDrillDown?: (metricType: string, label: string, value: string | number, entityId?: string) => void;
}

export function ExpenseBreakdownView({
  rawLedger,
  totalExpenses,
  onOpenDrillDown,
}: ExpenseBreakdownViewProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const [mode, setMode] = useState<"category" | "vendor" | "attribution">("category");

  // Calculate categorized outflows from canonical ledger based on mode
  const rankingList = useMemo(() => {
    const paidOutflows = rawLedger.filter((t) => t.direction === "outflow" && t.status !== "cancelled");
    const groupingMap = new Map<string, { name: string; amount: number; count: number; entityId?: string }>();

    for (const tx of paidOutflows) {
      let groupKey = "Unallocated";
      let displayName = "Unallocated";

      if (mode === "category") {
        groupKey = tx.categoryName || tx.category || (tx.allocation === "payroll" ? "People & Salaries" : tx.allocation === "sponsoring_purchase" ? "Sponsoring Ad Spend" : "Unallocated");
        displayName = groupKey;
      } else if (mode === "vendor") {
        groupKey = tx.vendor || "Direct / No Vendor Specified";
        displayName = groupKey;
      } else if (mode === "attribution") {
        if (tx.clientId && tx.clientName) {
          groupKey = `client:${tx.clientId}`;
          displayName = `Client Direct Cost: ${tx.clientName}`;
        } else if (tx.allocation === "payroll") {
          groupKey = "payroll";
          displayName = "Team Salaries & Payroll";
        } else if (tx.allocation === "software") {
          groupKey = "software";
          displayName = "SaaS Software Subscriptions";
        } else {
          groupKey = "unallocated_overhead";
          displayName = "Unallocated Operational Overhead";
        }
      }

      const amt = Number(tx.amount || 0);
      const existing = groupingMap.get(groupKey) || { name: displayName, amount: 0, count: 0, entityId: groupKey };
      existing.amount += amt;
      existing.count++;
      groupingMap.set(groupKey, existing);
    }

    const list = Array.from(groupingMap.values()).map((c) => {
      const pct = totalExpenses > 0 ? Math.round((c.amount / totalExpenses) * 1000) / 10 : 0;
      return {
        ...c,
        percentage: pct,
      };
    });

    return list.sort((a, b) => b.amount - a.amount);
  }, [rawLedger, totalExpenses, mode]);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4 text-start">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <PieChart className="size-4 text-rose-500" />
            <h3 className="font-bold text-sm font-heading text-foreground">
              {isAr ? "أين تذهب أموال سدى؟ تفصيل المصاريف" : "Where Does the Money Go? (Expense Ranking)"}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {isAr
              ? "ترتيب تنازلي للأبواب والموردين والتخصيص • مع فصل المصاريف غير المخصصة"
              : "Ranked category, vendor, & client attribution with explicit unallocated tracking"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs font-mono font-bold text-rose-400 border-rose-500/20 bg-rose-500/5">
            {formatCurrency(totalExpenses)}
          </Badge>
        </div>
      </div>

      {/* Mode Selector Toggles */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40 border border-border/50 text-xs font-mono w-full sm:w-fit">
        <Button
          type="button"
          size="sm"
          variant={mode === "category" ? "default" : "ghost"}
          onClick={() => setMode("category")}
          className="h-7 text-[10px] sm:text-xs px-1 sm:px-2.5 rounded-lg justify-center"
        >
          {isAr ? "حسب الباب" : "By Category"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "vendor" ? "default" : "ghost"}
          onClick={() => setMode("vendor")}
          className="h-7 text-[10px] sm:text-xs px-1 sm:px-2.5 rounded-lg justify-center"
        >
          {isAr ? "حسب المورد" : "By Vendor"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "attribution" ? "default" : "ghost"}
          onClick={() => setMode("attribution")}
          className="h-7 text-[10px] sm:text-xs px-1 sm:px-2.5 rounded-lg justify-center"
        >
          {isAr ? "حسب التخصيص" : "By Attribution"}
        </Button>
      </div>

      {rankingList.length === 0 ? (
        <div className="py-8 px-4 flex items-center justify-center text-center bg-muted/20 rounded-xl border border-dashed border-border/80">
          <p className="text-xs font-mono text-muted-foreground">
            {isAr ? "لا توجد مصاريف مسجلة في هذه الفترة" : "No expense outflows recorded in this reporting period"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {rankingList.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onOpenDrillDown?.("monthly_expenses", `${item.name} Expenses`, formatCurrency(item.amount), item.entityId)}
              className="group p-2.5 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer space-y-1.5"
            >
              <div className="space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between text-xs">
                {/* Line 1 on mobile: Rank + Full Name + Percentage Badge */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors text-xs sm:text-sm">
                      {item.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 sm:hidden" dir="ltr">
                    {item.percentage}%
                  </Badge>
                </div>

                {/* Line 2 on mobile: Transaction Count + Prominent Amount */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-0.5 sm:pt-0">
                  <span className="text-[10px] text-muted-foreground">
                    {item.count} {isAr ? "عملية" : "tx"}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-500 dark:text-rose-400 text-xs sm:text-sm" dir="ltr">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline-block w-12 text-end" dir="ltr">
                      {item.percentage}%
                    </span>
                    <ArrowUpRight className="size-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                  </div>
                </div>
              </div>

              {/* Visual Horizontal Bar */}
              <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0
                      ? "bg-gradient-to-r from-rose-500 to-amber-500"
                      : idx === 1
                      ? "bg-gradient-to-r from-amber-500 to-primary"
                      : "bg-primary/70"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
