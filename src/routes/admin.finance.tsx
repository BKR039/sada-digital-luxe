import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { FinancialPeriod, DrillDownCategory, DrillDownState } from "@/types/finance";
import {
  getPresetPeriod,
  fetchCompanyFinance,
  exportTransactionsToCSV,
  buildDrillDownData,
  type SuperAdminFinanceState,
} from "@/lib/finance-service";
import { FinanceHeader } from "@/components/admin/finance/FinanceHeader";
import { FinanceKPICards } from "@/components/admin/finance/FinanceKPICards";
import { FinanceOverviewChart } from "@/components/admin/finance/FinanceOverviewChart";
import { FinanceInsightsSection } from "@/components/admin/finance/FinanceInsightsSection";
import { FinanceRevenueAndProfitSummary } from "@/components/admin/finance/FinanceRevenueAndProfitSummary";
import { FinanceDrillDownModal } from "@/components/admin/finance/FinanceDrillDownModal";
import { CanonicalLedgerView } from "@/components/admin/finance/CanonicalLedgerView";
import { InvoicesRevenueView } from "@/components/admin/finance/InvoicesRevenueView";
import { SponsoringEngineView } from "@/components/admin/finance/SponsoringEngineView";
import { CashFlowAccountsView } from "@/components/admin/finance/CashFlowAccountsView";
import { ClientProfitabilityView } from "@/components/admin/finance/ClientProfitabilityView";
import { CommissionsView } from "@/components/admin/finance/CommissionsView";
import { MonthlyClosingView } from "@/components/admin/finance/MonthlyClosingView";
import { ExpenseTable } from "@/components/admin/finance/ExpenseTable";
import { IncomeTable } from "@/components/admin/finance/IncomeTable";
import { RecordIncomeModal } from "@/components/admin/finance/RecordIncomeModal";
import { SalariesView } from "@/components/admin/finance/SalariesView";
import { SalaryRequestsView } from "@/components/admin/finance/SalaryRequestsView";
import { SubscriptionsView } from "@/components/admin/finance/SubscriptionsView";
import { FinanceSectionNav } from "@/components/admin/finance/FinanceSectionNav";
import { ModuleAccessShield } from "@/components/admin/ModuleAccessShield";
import { SADAButton, FinanceDashboardSkeleton } from "@/components/ui/sada-ui";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTranslation } from "@/i18n";

export const Route = createFileRoute("/admin/finance")({
  component: AdminFinancePage,
});

export function AdminFinancePage() {
  const { user, isSuperAdmin, canAccessModule, loading: authLoading } = useAuth();
  const canAccessFinance = isSuperAdmin || canAccessModule("finance");
  const { language, isRTL } = useTranslation();
  const isAr = isRTL || language === "ar";
  const nav = useNavigate();

  // Period state
  const [period, setPeriod] = useState<FinancialPeriod>(() => getPresetPeriod("this_month"));
  const [activeTab, setActiveTab] = useState("overview");

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  // Auxiliary entities for relationships
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string; client_name: string }>>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    role: string;
    division: string;
    photo_url: string | null;
  }>>([]);

  // Financial State
  const [financeData, setFinanceData] = useState<Omit<SuperAdminFinanceState, "loading" | "error">>({
    period,
    kpis: {
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      cash: 0,
      outstandingPayments: 0,
      sponsoringMargin: 0,
      payroll: 0,
      operatingExpenses: 0,
      clientServicesRevenue: 0,
      sponsoringCollected: 0,
      otherRevenue: 0,
      sponsoringPurchasesCost: 0,
      salesCommissionsCost: 0,
      pendingIncome: 0,
      pendingExpenses: 0,
      pendingSalaryRequestsCount: 0,
      pendingSalaryRequestsTotal: 0,
      prevRevenue: 0,
      prevExpenses: 0,
      prevNetProfit: 0,
      revenueDeltaPercent: null,
      expenseDeltaPercent: null,
      profitDeltaPercent: null,
      totalIncome: 0,
      totalExpenses: 0,
      netCashFlow: 0,
      totalSalaries: 0,
      recurringBurn: 0,
      prevTotalIncome: 0,
      prevTotalExpenses: 0,
      prevNetCashFlow: 0,
      incomeDeltaPercent: null,
    },
    ledgerTransactions: [],
    incomes: [],
    expenses: [],
    categories: [],
    subscriptions: [],
    salaryRecords: [],
    salaryPayments: [],
    salaryRequests: [],
    invoices: [],
    sponsoringCampaigns: [],
    commissions: [],
    accounts: [],
    closingPeriods: [],
    clientProfitability: [],
    cashFlow: {
      openingCash: 0,
      clientPayments: 0,
      otherIncome: 0,
      totalInflows: 0,
      sponsoringPurchases: 0,
      payroll: 0,
      commissions: 0,
      operatingExpenses: 0,
      withdrawals: 0,
      totalOutflows: 0,
      closingCash: 0,
      accounts: [],
    },
    auditLogs: [],
    insights: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick modals triggers
  const [openNewIncome, setOpenNewIncome] = useState(false);
  const [openNewExpense, setOpenNewExpense] = useState(false);

  // Load auxiliary data (Clients, Projects, Team) - Super Admin only
  useEffect(() => {
    async function loadAux() {
      try {
        const [cRes, pRes, tRes] = await Promise.all([
          (supabase as any).from("clients").select("id, name").order("name", { ascending: true }),
          (supabase as any).from("client_projects").select("id, title, client_name").order("created_at", { ascending: false }),
          (supabase as any).from("team_members").select("id, name, email, position, role, division, photo_url").order("name", { ascending: true }),
        ]);

        if (cRes.data) setClients(cRes.data);
        if (pRes.data) setProjects(pRes.data);
        if (tRes.data) setTeamMembers(tRes.data);
      } catch (err) {
        console.error("[AdminFinancePage] Error loading aux records:", err);
      }
    }

    if (canAccessFinance) {
      loadAux();
    }
  }, [canAccessFinance]);

  // Load financial data for period - Authorized Finance users
  const loadFinance = useCallback(async (isBackground = false) => {
    if (!canAccessFinance) return;
    if (!isBackground) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchCompanyFinance(period);
      setFinanceData(data);
    } catch (err: any) {
      console.error("[AdminFinancePage] Load error:", err);
      setError(err?.message || "Failed to load financial data.");
    } finally {
      setLoading(false);
    }
  }, [period, canAccessFinance]);

  useEffect(() => {
    if (canAccessFinance) {
      loadFinance();

      const channel = supabase
        .channel("realtime:admin_finance")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "income_transactions" },
          () => { loadFinance(true); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "expense_transactions" },
          () => { loadFinance(true); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "salary_requests" },
          () => { loadFinance(true); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "invoices" },
          () => { loadFinance(true); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadFinance, canAccessFinance]);

  // Handle Export
  const handleExport = (type: "all" | "incomes" | "expenses") => {
    exportTransactionsToCSV({
      type,
      incomes: financeData.incomes,
      expenses: financeData.expenses,
      ledger: financeData.ledgerTransactions,
      periodLabel: period.label,
    });
  };

  // Handle Drill Down Open
  const handleOpenDrillDown = (category: DrillDownCategory) => {
    const data = buildDrillDownData(category, financeData);
    setDrillDown(data);
  };

  // Authorization Shield & Initial Load
  if (authLoading || (loading && !financeData.incomes.length && !financeData.expenses.length)) {
    return <FinanceDashboardSkeleton />;
  }

  if (!canAccessFinance) {
    return <ModuleAccessShield module="finance" />;
  }

  const currentUserName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    (isAr ? "المدير العام" : "Super Admin");

  const periodMonthString = (() => {
    try {
      return format(parseISO(period.startDate), "yyyy-MM");
    } catch {
      return format(new Date(), "yyyy-MM");
    }
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <FinanceHeader
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={loadFinance}
        loading={loading}
        onOpenNewIncome={() => {
          setActiveTab("inflows");
          setOpenNewIncome(true);
        }}
        onOpenNewExpense={() => {
          setActiveTab("expenses");
          setOpenNewExpense(true);
        }}
        onExport={handleExport}
        onCloseMonth={() => setActiveTab("closing")}
      />

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <SADAButton
            onClick={() => loadFinance()}
            size="sm"
            variant="secondary"
            className="text-[11px] h-7 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-900 dark:text-rose-100 border-none shrink-0"
          >
            {isAr ? "إعادة المحاولة" : "Retry"}
          </SADAButton>
        </div>
      )}

      {/* KPI Cards Strip (All cards clickable with mathematical drill-down) */}
      <FinanceKPICards
        kpis={financeData.kpis}
        periodLabel={period.label}
        onDrillDown={handleOpenDrillDown}
      />

      {/* Main Tabs Navigation (Responsive Multi-Row Command Center Grid — Zero Horizontal Scrolling) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <FinanceSectionNav
          counts={{
            ledger: financeData.ledgerTransactions.length,
            inflows: financeData.incomes.length,
            sponsoring: financeData.sponsoringCampaigns.length,
            expenses: financeData.expenses.length,
            subscriptions: financeData.subscriptions.length,
            commissions: financeData.commissions.length,
          }}
          hasPendingSalaryRequests={financeData.kpis.pendingSalaryRequestsCount > 0}
        />

        {/* Tab 1: Overview & Signals */}
        <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
          <FinanceRevenueAndProfitSummary
            kpis={financeData.kpis}
            onDrillDown={handleOpenDrillDown}
          />

          <FinanceOverviewChart
            incomes={financeData.incomes}
            expenses={financeData.expenses}
            categories={financeData.categories}
            periodLabel={period.label}
          />
          <FinanceInsightsSection insights={financeData.insights} />
        </TabsContent>

        {/* Tab 2: Canonical Unified Ledger */}
        <TabsContent value="ledger" className="focus-visible:outline-none">
          <CanonicalLedgerView
            transactions={financeData.ledgerTransactions}
            onRefresh={loadFinance}
            onExport={() => handleExport("all")}
          />
        </TabsContent>

        {/* Tab 3: Operational Inflows (Direct Incomes) */}
        <TabsContent value="inflows" className="focus-visible:outline-none">
          <IncomeTable
            incomes={financeData.incomes}
            clients={clients}
            projects={projects}
            accounts={financeData.accounts}
            onRefresh={loadFinance}
            openCreateModal={openNewIncome}
            onCloseCreateModal={() => setOpenNewIncome(false)}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 4: Revenue & Invoices */}
        <TabsContent value="revenue" className="focus-visible:outline-none">
          <InvoicesRevenueView
            invoices={financeData.invoices}
            clients={clients}
            accounts={financeData.accounts}
            clientServicesRevenue={financeData.kpis.clientServicesRevenue}
            sponsoringCollected={financeData.kpis.sponsoringCollected}
            otherRevenue={financeData.kpis.otherRevenue}
            totalRevenue={financeData.kpis.revenue}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 5: Sponsoring & Arbitrage */}
        <TabsContent value="sponsoring" className="focus-visible:outline-none">
          <SponsoringEngineView
            campaigns={financeData.sponsoringCampaigns}
            clients={clients}
            accounts={financeData.accounts}
            sponsoringCollected={financeData.kpis.sponsoringCollected}
            sponsoringPurchasesCost={financeData.kpis.sponsoringPurchasesCost}
            sponsoringMargin={financeData.kpis.sponsoringMargin}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 6: Direct Outflows */}
        <TabsContent value="expenses" className="focus-visible:outline-none">
          <ExpenseTable
            expenses={financeData.expenses}
            categories={financeData.categories}
            clients={clients}
            projects={projects}
            teamMembers={teamMembers}
            onRefresh={loadFinance}
            openCreateModal={openNewExpense}
            onCloseCreateModal={() => setOpenNewExpense(false)}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 7: SaaS Subscriptions & Recurring Burn */}
        <TabsContent value="subscriptions" className="focus-visible:outline-none">
          <SubscriptionsView
            subscriptions={financeData.subscriptions}
            categories={financeData.categories}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 8: Salaries & Payroll */}
        <TabsContent value="salaries" className="focus-visible:outline-none">
          <SalariesView
            salaryRecords={financeData.salaryRecords}
            salaryPayments={financeData.salaryPayments}
            teamMembers={teamMembers}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 9: Commissions */}
        <TabsContent value="commissions" className="focus-visible:outline-none">
          <CommissionsView
            commissions={financeData.commissions}
            clients={clients}
            teamMembers={teamMembers}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 10: Salary Requests */}
        <TabsContent value="requests" className="focus-visible:outline-none">
          <SalaryRequestsView
            salaryRequests={financeData.salaryRequests}
            salaryRecords={financeData.salaryRecords}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>

        {/* Tab 11: Cash Flow & Treasury Accounts */}
        <TabsContent value="cashflow" className="focus-visible:outline-none">
          <CashFlowAccountsView
            cashFlow={financeData.cashFlow}
            accounts={financeData.accounts}
            periodLabel={period.label}
            onRefresh={loadFinance}
          />
        </TabsContent>

        {/* Tab 12: Client Profitability Matrix */}
        <TabsContent value="profitability" className="focus-visible:outline-none">
          <ClientProfitabilityView
            records={financeData.clientProfitability}
            transactions={financeData.ledgerTransactions}
          />
        </TabsContent>

        {/* Tab 13: Monthly Closing & Audit Log */}
        <TabsContent value="closing" className="focus-visible:outline-none">
          <MonthlyClosingView
            currentPeriodMonth={periodMonthString}
            closingPeriods={financeData.closingPeriods}
            kpis={financeData.kpis}
            auditLogs={financeData.auditLogs}
            onRefresh={loadFinance}
            currentUserId={user?.id}
            currentUserName={currentUserName}
          />
        </TabsContent>
      </Tabs>

      {/* Drill Down Modal (Calculated formula + filtered underlying ledger transactions) */}
      <FinanceDrillDownModal
        drillDown={drillDown}
        isOpen={!!drillDown}
        onClose={() => setDrillDown(null)}
      />

      {/* Quick Global Record Inflow Modal */}
      <RecordIncomeModal
        isOpen={openNewIncome}
        onClose={() => setOpenNewIncome(false)}
        onRefresh={loadFinance}
        clients={clients}
        projects={projects}
        accounts={financeData.accounts}
        currentUserId={user?.id}
        currentUserName={currentUserName}
      />
    </div>
  );
}
