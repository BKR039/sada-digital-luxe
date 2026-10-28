import { useMemo } from "react";
import {
  IncomeTransaction,
  ExpenseTransaction,
  ExpenseCategory,
  formatCurrency,
} from "@/types/finance";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, startOfDay } from "date-fns";

interface FinanceOverviewChartProps {
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  categories: ExpenseCategory[];
  periodLabel: string;
}

function safeFormatDate(d: string | null | undefined, fmt: string = "MMM d"): string {
  if (!d) return "—";
  try {
    const parsed = parseISO(d);
    if (isNaN(parsed.getTime())) return d;
    return format(parsed, fmt);
  } catch {
    return d || "—";
  }
}

export function FinanceOverviewChart({
  incomes,
  expenses,
  categories,
  periodLabel,
}: FinanceOverviewChartProps) {
  // Aggregate daily or grouped buckets for Income vs Expense
  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; displayDate: string; income: number; expense: number }> = {};

    for (const inc of incomes) {
      if (inc.status === "cancelled") continue;
      const d = inc.date || "unknown";
      if (!buckets[d]) {
        buckets[d] = {
          date: d,
          displayDate: safeFormatDate(inc.date, "MMM d"),
          income: 0,
          expense: 0,
        };
      }
      buckets[d].income += Number(inc.amount || 0);
    }

    for (const exp of expenses) {
      if (exp.status === "cancelled") continue;
      const d = exp.date || "unknown";
      if (!buckets[d]) {
        buckets[d] = {
          date: d,
          displayDate: safeFormatDate(exp.date, "MMM d"),
          income: 0,
          expense: 0,
        };
      }
      buckets[d].expense += Number(exp.amount || 0);
    }

    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }, [incomes, expenses]);

  // Category distribution
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, { name: string; amount: number; color: string }> = {};

    const catColorMap = new Map(categories.map((c) => [c.name, c.color]));

    let totalExpenseSum = 0;
    for (const exp of expenses) {
      if (exp.status === "cancelled") continue;
      const name = exp.category_name || "Other";
      const amt = Number(exp.amount || 0);
      totalExpenseSum += amt;

      if (!totals[name]) {
        totals[name] = {
          name,
          amount: 0,
          color: catColorMap.get(name) || "#8B5CF6",
        };
      }
      totals[name].amount += amt;
    }

    return Object.values(totals)
      .map((item) => ({
        ...item,
        percentage: totalExpenseSum > 0 ? Math.round((item.amount / totalExpenseSum) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, categories]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Inflow vs Outflow Chart (2 cols) */}
      <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div>
            <h2 className="text-sm font-bold font-display text-foreground">
              Cash Flow Velocity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily realized inflows vs operational disbursements for {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="size-2 rounded-full bg-emerald-500" />
              Inflow
            </span>
            <span className="flex items-center gap-1.5 text-rose-500 font-medium">
              <span className="size-2 rounded-full bg-rose-500" />
              Outflow
            </span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full mt-4">
          {chartData.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-xs font-mono text-muted-foreground/70">
              No transactions recorded in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value || 0)),
                    name === "income" ? "Inflow" : "Outflow",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "0.75rem",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="income" name="income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Expense Category Distribution (1 col) */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between">
        <div className="pb-3 border-b border-border/40">
          <h2 className="text-sm font-bold font-display text-foreground">
            Where Money Goes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational expense breakdown by category
          </p>
        </div>

        <div className="mt-4 flex-1 space-y-3.5 overflow-y-auto max-h-72 pr-1">
          {categoryBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-mono text-muted-foreground/70">
              No expenses in this period
            </div>
          ) : (
            categoryBreakdown.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[160px]">
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-foreground">
                      {formatCurrency(cat.amount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, cat.percentage)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
