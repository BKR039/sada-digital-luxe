import React, { useState, useMemo } from "react";
import { formatCurrency } from "@/types/finance";
import type { RevenueTrendItem } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Layers, Filter } from "lucide-react";

interface FinancialTrendsChartProps {
  revenueTrends: RevenueTrendItem[];
  onOpenDrillDown?: (metricType: string, label: string, value: string | number) => void;
}

export function FinancialTrendsChart({
  revenueTrends,
  onOpenDrillDown,
}: FinancialTrendsChartProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [showProfit, setShowProfit] = useState(true);

  const formattedData = useMemo(() => {
    return revenueTrends.map((item) => ({
      ...item,
      displayRevenue: item.totalRevenue,
      displayExpenses: item.totalExpenses ?? Math.max(0, item.totalRevenue - item.netProfit),
      displayProfit: item.netProfit,
    }));
  }, [revenueTrends]);

  const hasData = revenueTrends.some((r) => r.totalRevenue > 0 || r.netProfit !== 0 || (r.totalExpenses ?? 0) > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="p-3 rounded-xl bg-popover/95 border border-border shadow-xl backdrop-blur-md text-xs font-mono space-y-1.5 z-50">
        <p className="font-bold text-foreground pb-1 border-b border-border/60">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </span>
            <span className="font-bold text-foreground">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4 text-start">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="font-bold text-sm font-heading text-foreground">
              {isAr ? "اتجاهات الإيرادات والمصاريف والأرباح الصافية (6 أشهر)" : "Revenue, Expenses & Profit Trend (6 Months)"}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {isAr
              ? "مقارنة شهرية مباشرة مستخلصة من دفتر الأستاذ العام المعتمد • بدون افتراضات"
              : "Authoritative monthly trajectory derived strictly from canonical financial ledger"}
          </p>
        </div>

        {/* Series Toggles */}
        <div className="grid grid-cols-3 gap-1 w-full sm:w-auto p-1 bg-muted/40 rounded-xl border border-border/50">
          <Button
            type="button"
            size="sm"
            variant={showRevenue ? "default" : "ghost"}
            onClick={() => setShowRevenue(!showRevenue)}
            className="h-7 text-[10px] sm:text-xs font-mono px-1.5 sm:px-2.5 rounded-lg justify-center"
          >
            <span className="size-2 rounded-full bg-primary me-1 inline-block shrink-0" />
            <span className="truncate">{isAr ? "الإيرادات" : "Revenue"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={showExpenses ? "default" : "ghost"}
            onClick={() => setShowExpenses(!showExpenses)}
            className="h-7 text-[10px] sm:text-xs font-mono px-1.5 sm:px-2.5 rounded-lg justify-center"
          >
            <span className="size-2 rounded-full bg-rose-500 me-1 inline-block shrink-0" />
            <span className="truncate">{isAr ? "المصاريف" : "Expenses"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={showProfit ? "default" : "ghost"}
            onClick={() => setShowProfit(!showProfit)}
            className="h-7 text-[10px] sm:text-xs font-mono px-1.5 sm:px-2.5 rounded-lg justify-center"
          >
            <span className="size-2 rounded-full bg-emerald-500 me-1 inline-block shrink-0" />
            <span className="truncate">{isAr ? "الربح الصافي" : "Net Profit"}</span>
          </Button>
        </div>
      </div>

      {/* Chart Canvas */}
      {!hasData ? (
        <div className="py-8 px-4 sm:h-64 flex flex-col items-center justify-center text-center bg-muted/20 rounded-xl border border-dashed border-border/80">
          <Layers className="size-7 sm:size-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-mono text-muted-foreground">
            {isAr ? "لا توجد معاملات كافية مسجلة في الأشهر السابقة لبناء خط الاتجاه" : "Insufficient historical transactions for trendline projection"}
          </p>
        </div>
      ) : (
        <div className="h-56 sm:h-72 w-full pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickFormatter={(val) => {
                  if (!val) return "";
                  const parts = String(val).trim().split(/\s+/);
                  return parts[0] || val;
                }}
              />
              <YAxis
                width={36}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                  if (val === 0) return "0";
                  if (val >= 1000) {
                    const kVal = val / 1000;
                    return kVal % 1 === 0 ? `${kVal}k` : `${kVal.toFixed(1)}k`;
                  }
                  return String(val);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              {showRevenue && (
                <Bar
                  dataKey="displayRevenue"
                  name={isAr ? "إجمالي الإيرادات" : "Total Revenue"}
                  fill="var(--color-primary, #6366F1)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                  cursor="pointer"
                  onClick={(entry) => onOpenDrillDown?.("monthly_revenue", `Revenue (${entry.monthLabel})`, entry.displayRevenue)}
                />
              )}
              {showExpenses && (
                <Bar
                  dataKey="displayExpenses"
                  name={isAr ? "المصاريف التشغيلية" : "Operating Expenses"}
                  fill="#F43F5E"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                  cursor="pointer"
                  onClick={(entry) => onOpenDrillDown?.("monthly_expenses", `Expenses (${entry.monthLabel})`, entry.displayExpenses)}
                />
              )}
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="displayProfit"
                  name={isAr ? "صافي الربح" : "Net Profit"}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10B981", strokeWidth: 1, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
