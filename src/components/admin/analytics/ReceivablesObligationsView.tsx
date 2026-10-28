import React from "react";
import { Link } from "@tanstack/react-router";
import { formatCurrency } from "@/types/finance";
import { useTranslation } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  CreditCard,
  ArrowUpRight,
  Clock,
  Calendar,
} from "lucide-react";

interface ReceivablesObligationsViewProps {
  rawInvoices: any[];
  salaryRecords: any[];
  commissions: any[];
  subscriptions: any[];
  onOpenDrillDown?: (metricType: string, label: string, value: string | number) => void;
}

export function ReceivablesObligationsView({
  rawInvoices,
  salaryRecords,
  commissions,
  subscriptions,
  onOpenDrillDown,
}: ReceivablesObligationsViewProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const now = new Date();

  // Receivables
  const unpaidInvoices = rawInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const overdueInvoices = unpaidInvoices.filter(
    (i) => i.status === "overdue" || (i.dueDate && new Date(i.dueDate) < now)
  );

  const totalOutstanding = unpaidInvoices.reduce(
    (sum, i) => sum + Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0)),
    0
  );
  const totalOverdue = overdueInvoices.reduce(
    (sum, i) => sum + Math.max(0, Number(i.totalAmount || 0) - Number(i.paidAmount || 0)),
    0
  );

  // Obligations
  const baseSalaries = salaryRecords.reduce((sum, s) => sum + Number(s.base_amount || 0), 0);
  const approvedComms = commissions
    .filter((c) => c.status === "approved")
    .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
  const totalPayrollObligation = baseSalaries + approvedComms;

  const monthlySaaS = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const amt = Number(s.amount || 0);
      if (s.billing_cycle === "quarterly") return sum + amt / 3;
      if (s.billing_cycle === "yearly") return sum + amt / 12;
      return sum + amt;
    }, 0);

  const totalUpcomingObligations = totalPayrollObligation + monthlySaaS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-start font-mono text-xs">
      {/* 1. RECEIVABLES CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-amber-500" />
            <h4 className="font-bold uppercase tracking-wider text-foreground">
              {isAr ? "المستحقات والفواتير المعلقة" : "Receivables & Unpaid Invoices"}
            </h4>
          </div>
          <span className="font-bold text-amber-500">
            {formatCurrency(totalOutstanding)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              <span>{isAr ? "فواتير متأخرة تجاوزت الاستحقاق:" : "Overdue Invoices:"}</span>
            </div>
            <span className="font-bold">{formatCurrency(totalOverdue)} ({overdueInvoices.length})</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
            {unpaidInvoices.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="p-2 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">
                    {inv.clientName || "Client"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    #{inv.invoiceNumber} • {inv.dueDate ? `Due: ${inv.dueDate}` : "No due date"}
                  </span>
                </div>
                <div className="text-end shrink-0 ms-2">
                  <span className="font-bold text-foreground">
                    {formatCurrency(Math.max(0, Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)))}
                  </span>
                  <Badge
                    variant="outline"
                    className={`block text-[9px] px-1 py-0 mt-0.5 ${
                      inv.status === "overdue"
                        ? "text-rose-500 border-rose-500/20"
                        : "text-amber-500 border-amber-500/20"
                    }`}
                  >
                    {inv.status?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. OBLIGATIONS CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-rose-500" />
            <h4 className="font-bold uppercase tracking-wider text-foreground">
              {isAr ? "الالتزامات المالية القادمة" : "Upcoming Payment Obligations"}
            </h4>
          </div>
          <span className="font-bold text-rose-400">
            {formatCurrency(totalUpcomingObligations)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
            <span className="text-muted-foreground">{isAr ? "التزامات الرواتب الأساسية:" : "Base Monthly Payroll:"}</span>
            <span className="font-bold text-foreground">{formatCurrency(baseSalaries)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
            <span className="text-muted-foreground">{isAr ? "عمولات المبيعات المعتمدة:" : "Approved Commissions:"}</span>
            <span className="font-bold text-foreground">{formatCurrency(approvedComms)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
            <span className="text-muted-foreground">{isAr ? "اشتراكات البرمجيات الشهرية:" : "Monthly SaaS Subscriptions:"}</span>
            <span className="font-bold text-foreground">{formatCurrency(monthlySaaS)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
