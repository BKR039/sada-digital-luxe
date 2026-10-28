import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/lib/date-locale";
import {
  SalaryRecord,
  SalaryPayment,
  SalaryRequest,
  formatCurrency,
} from "@/types/finance";
import {
  fetchWorkerSalaryData,
  submitWorkerSalaryRequest,
} from "@/lib/finance-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";
import {
  SADAButton,
  SADAInput,
  SADATextarea,
  SADADatePicker,
  SADADialog,
  MySalarySkeleton,
} from "@/components/ui/sada-ui";
import {
  Wallet,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Loader2,
  RefreshCw,
  Coins,
} from "lucide-react";
import { format, parseISO, isThisYear } from "date-fns";

export type SalaryVerificationStatus =
  | "CONFIGURED"
  | "PROFILE_NOT_FOUND"
  | "UNAUTHORIZED_PROFILE_ACCESS"
  | "COMPENSATION_PROFILE_NOT_FOUND"
  | "BASE_SALARY_NOT_CONFIGURED"
  | "INVALID_COMPENSATION_DATA"
  | "ADVANCE_LIMIT_CALCULATION_FAILED";

export interface SalaryVerificationResult {
  status: SalaryVerificationStatus;
  isValid: boolean;
  title: string | null;
  userMessage: string | null;
}

export function getSalaryVerificationStatus({
  user,
  effectiveMemberId,
  salaryRecord,
  maxAdvanceAmount,
  isAr = false,
}: {
  user: any;
  effectiveMemberId: string | null;
  salaryRecord: SalaryRecord | null;
  maxAdvanceAmount: number;
  isAr?: boolean;
}): SalaryVerificationResult {
  if (!user) {
    return {
      status: "UNAUTHORIZED_PROFILE_ACCESS",
      isValid: false,
      title: isAr ? "تسجيل الدخول مطلوب" : "Authentication Required",
      userMessage: isAr ? "يجب تسجيل الدخول للوصول إلى ميزات الراتب والتعويضات." : "You must be signed in to access salary and compensation features.",
    };
  }
  if (!effectiveMemberId) {
    return {
      status: "PROFILE_NOT_FOUND",
      isValid: false,
      title: isAr ? "ملف الفريق غير مرتبط" : "Team Profile Unlinked",
      userMessage: isAr ? "حسابك غير مرتبط بملف عضو في الفريق بشكل صحيح. يُرجى الاتصال بالإدارة." : "Your account is not correctly linked to a team profile. Please contact an administrator.",
    };
  }
  if (!salaryRecord) {
    return {
      status: "COMPENSATION_PROFILE_NOT_FOUND",
      isValid: false,
      title: isAr ? "ملف الراتب غير مهيأ" : "Salary Profile Not Configured",
      userMessage: isAr ? "لم تتم تهيئة ملف راتبك بعد. يُرجى الاتصال بالإدارة." : "Your salary profile has not been configured yet. Please contact an administrator.",
    };
  }
  if (salaryRecord.status !== "active") {
    return {
      status: "INVALID_COMPENSATION_DATA",
      isValid: false,
      title: isAr ? "ملف التعويضات غير نشط" : "Compensation Profile Inactive",
      userMessage: isAr ? "ملف التعويضات الخاص بك غير نشط. يُرجى الاتصال بالإدارة." : "Your compensation profile is not active. Please contact an administrator.",
    };
  }
  const baseSalary = Number(salaryRecord.base_amount || 0);
  if (baseSalary <= 0) {
    return {
      status: "BASE_SALARY_NOT_CONFIGURED",
      isValid: false,
      title: isAr ? "الراتب الأساسي غير محدد" : "Base Salary Unset",
      userMessage: isAr ? "لم يتم تحديد راتبك الشهري الأساسي بعد. يُرجى الاتصال بالإدارة." : "Your base monthly salary is not configured yet. Please contact an administrator.",
    };
  }
  if (maxAdvanceAmount <= 0) {
    return {
      status: "ADVANCE_LIMIT_CALCULATION_FAILED",
      isValid: false,
      title: isAr ? "خطأ في الحساب" : "Calculation Error",
      userMessage: isAr ? "تعذر حساب الحد الأقصى المتاح للتسبيق. يُرجى الاتصال بالإدارة." : "Unable to calculate your eligible advance limit. Please contact an administrator.",
    };
  }

  return {
    status: "CONFIGURED",
    isValid: true,
    title: null,
    userMessage: null,
  };
}

export const Route = createFileRoute("/admin/my-salary")({
  component: WorkerSalaryPage,
});

export function WorkerSalaryPage() {
  const { user, teamMember, teamMemberId: authTmId, loading: authLoading } = useAuth();
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [salaryRecord, setSalaryRecord] = useState<SalaryRecord | null>(null);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [requests, setRequests] = useState<SalaryRequest[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [workSessions, setWorkSessions] = useState<any[]>([]);
  const [totalProductionMinutes, setTotalProductionMinutes] = useState(0);
  const [totalAdminMinutes, setTotalAdminMinutes] = useState(0);
  const [activeTab, setActiveTab] = useState<"payouts" | "requests" | "commissions" | "hours">("payouts");
  const [loading, setLoading] = useState(true);

  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState("");
  const [requestedDate, setRequestedDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadData = useCallback(async (forceLoading = false) => {
    if (!user) return;
    const isInitial = !salaryRecord && payments.length === 0 && requests.length === 0;
    if (forceLoading || isInitial) {
      setLoading(true);
    }
    try {
      const data = await fetchWorkerSalaryData(user.id, user.email);
      const effectiveTmId = data.teamMemberId || authTmId || teamMember?.id || null;
      setTeamMemberId(effectiveTmId);

      let record = data.salaryRecord;
      if (!record && effectiveTmId) {
        const { data: directRec } = await (supabase as any)
          .from("salary_records")
          .select("*, team_member:team_members(id, name, email, position, role, division, photo_url)")
          .eq("team_member_id", effectiveTmId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (directRec) record = directRec;
      }

      setSalaryRecord(record);
      setPayments(data.payments);
      setRequests(data.requests);
      setCommissions((data as any).commissions || []);
      setWorkSessions((data as any).workSessions || []);
      setTotalProductionMinutes((data as any).totalProductionMinutes || 0);
      setTotalAdminMinutes((data as any).totalAdminMinutes || 0);
    } catch (err) {
      console.error("[WorkerSalaryPage] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, authTmId, teamMember?.id]);

  useEffect(() => {
    if (user) {
      loadData();

      const channel = supabase
        .channel(`realtime:my_salary:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "salary_requests" },
          () => { loadData(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadData, user]);

  const maxAdvancePercent = getBusinessRuleNumber("max_salary_advance_percent", 50);
  const effectiveMemberId = teamMemberId || authTmId || teamMember?.id || null;
  const baseSalary = salaryRecord && Number(salaryRecord.base_amount) > 0 ? Number(salaryRecord.base_amount) : 0;
  const maxAdvanceAmount = baseSalary > 0 ? (baseSalary * maxAdvancePercent) / 100 : 0;

  const verification = getSalaryVerificationStatus({
    user,
    effectiveMemberId,
    salaryRecord,
    maxAdvanceAmount,
    isAr,
  });

  const handleOpenRequestModal = () => {
    setRequestedAmount("");
    setRequestedDate(new Date());
    setReason("");
    setNotes("");
    setSubmitError(null);
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verification.isValid) {
      setSubmitError(verification.userMessage || (isAr ? "ملفك غير مؤهل لطلب تسبيق على الراتب." : "Your profile is not ready for salary advances."));
      return;
    }

    const num = parseFloat(requestedAmount);
    if (isNaN(num) || num <= 0) {
      setSubmitError(isAr ? "يُرجى إدخال مبلغ صالح أكبر من 0 د.ت." : "Please enter a valid requested amount greater than 0 TND.");
      return;
    }

    if (num > maxAdvanceAmount) {
      setSubmitError(
        isAr
          ? `المبلغ المطلوب (${num} د.ت) يتجاوز الحد الأقصى المسموح به وهو ${maxAdvancePercent}% من الراتب الأساسي الشهري (${maxAdvanceAmount} د.ت).`
          : `Requested advance (${num} TND) exceeds the maximum allowed limit of ${maxAdvancePercent}% of base monthly salary (${maxAdvanceAmount} TND).`
      );
      return;
    }

    if (!reason.trim()) {
      setSubmitError(isAr ? "يُرجى كتابة سبب طلب التسبيق على الراتب." : "Please provide a reason for the early payment request.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const workerName =
      teamMember?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Team Member";

    const res = await submitWorkerSalaryRequest({
      teamMemberId: effectiveMemberId!,
      requestedAmount: num,
      requestedDate: format(requestedDate, "yyyy-MM-dd"),
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      workerName,
    });
    setIsSubmitting(false);

    if (!res.success || res.error) {
      setSubmitError(res.error?.message || (isAr ? "فشل إرسال الطلب." : "Failed to submit request."));
    } else {
      setIsRequestModalOpen(false);
      loadData();
    }
  };

  // Calculations
  const totalPaidThisYear = payments
    .filter((p) => p.status === "paid" && isThisYear(parseISO(p.payment_date)))
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const hourlyRate = salaryRecord ? Number(salaryRecord.base_amount || 0) / Number(salaryRecord.standard_monthly_hours || 160) : 0;
  const totalCommissionsEarned = commissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
  const totalProductionHours = Math.round((totalProductionMinutes / 60) * 10) / 10;
  const totalAdminHours = Math.round((totalAdminMinutes / 60) * 10) / 10;
  const isInitialLoad = !salaryRecord && payments.length === 0 && requests.length === 0;

  if (authLoading || (loading && isInitialLoad)) {
    return <MySalarySkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
              {isAr ? "بوابة الموظفين" : "Staff Portal"}
            </span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              {isAr ? "خاص ومحمي" : "Private & Isolated"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground mt-1">
            {isAr ? "راتبي وتعويضاتي" : "My Salary & Compensation"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {isAr
              ? "عرض راتبك الأساسي، وسجل الصرف، وتقديم طلبات التسبيق على الراتب."
              : "View your base remuneration, payout history, and submit early advance requests."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SADAButton
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            leftIcon={<RefreshCw className="size-3.5" />}
          >
            {isAr ? "تحديث" : "Refresh"}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleOpenRequestModal}
            leftIcon={<Plus className="size-3.5" />}
          >
            {isAr ? "طلب تسبيق على الراتب" : "Request Early Payment"}
          </SADAButton>
        </div>
      </div>

      {/* Primary Compensation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Current Base Salary */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {isAr ? "الراتب الأساسي الحالي" : "Current Base Salary"}
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Wallet className="size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
              {salaryRecord ? formatCurrency(salaryRecord.base_amount) : (isAr ? "قيد المراجعة" : "Under Review")}
            </div>
            {salaryRecord && (
              <p className="text-[11px] font-mono text-muted-foreground mt-0.5 capitalize">
                {salaryRecord.salary_type === "monthly" ? (isAr ? "راتب شهري" : "Monthly") :
                 salaryRecord.salary_type === "hourly" ? (isAr ? "أجر بالساعة" : "Hourly") :
                 salaryRecord.salary_type === "fixed_contract" ? (isAr ? "عقد محدد" : "Fixed Contract") :
                 salaryRecord.salary_type === "per_project" ? (isAr ? "لكل مشروع" : "Per Project") :
                 (salaryRecord.salary_type as string).replace(/_/g, " ")}
              </p>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{isAr ? "معدل التكلفة بالساعة:" : "Hourly Cost Rate:"}</span>
            <span className="font-bold text-primary">
              {hourlyRate > 0 ? (isAr ? `${hourlyRate.toFixed(2)} د.ت/س` : `${hourlyRate.toFixed(2)} TND/hr`) : "—"}
            </span>
          </div>
        </div>

        {/* Card 2: Sales Commissions */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {isAr ? "عمولات المبيعات" : "Sales Commissions"}
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Coins className="size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-amber-600 dark:text-amber-400 tracking-tight">
              {formatCurrency(totalCommissionsEarned)}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {isAr ? `عبر ${commissions.length} عمولة صفقات` : `Across ${commissions.length} deal commission(s)`}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{isAr ? "معتمدة / قيد الصرف:" : "Unpaid / Approved:"}</span>
            <span className="font-semibold text-foreground">
              {isAr ? `${commissions.filter((c) => c.status === "approved").length} بانتظار الصرف` : `${commissions.filter((c) => c.status === "approved").length} pending payout`}
            </span>
          </div>
        </div>

        {/* Card 3: Tracked Work Hours */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {isAr ? "الساعات المسجلة" : "Tracked Hours"}
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Clock className="size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight">
              {(totalProductionHours + totalAdminHours).toFixed(1)} {isAr ? "ساعة" : "hrs"}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {isAr ? "إنتاج:" : "Prod:"} <span className="font-semibold text-emerald-600 dark:text-emerald-400">{totalProductionHours}h</span> • {isAr ? "إدارة:" : "Admin:"} <span className="font-semibold text-amber-600 dark:text-amber-400">{totalAdminHours}h</span>
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{isAr ? "الجلسات المسجلة:" : "Logged Sessions:"}</span>
            <span className="font-semibold text-foreground">{workSessions.length}</span>
          </div>
        </div>

        {/* Card 4: Year-to-Date Remuneration */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              {isAr ? `المصروف في سنة ${new Date().getFullYear()}` : `Disbursed in ${new Date().getFullYear()}`}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-4" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(totalPaidThisYear)}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {isAr ? `عبر ${payments.filter((p) => p.status === "paid").length} دفعة مسجلة` : `Across ${payments.filter((p) => p.status === "paid").length} recorded payout(s)`}
            </p>
          </div>

          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{isAr ? "الطلبات المعلقة:" : "Pending Requests:"}</span>
            <span
              className={`font-semibold ${
                pendingRequests.length > 0 ? "text-amber-500" : "text-foreground"
              }`}
            >
              {pendingRequests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: "payouts", label: isAr ? "المدفوعات والمستحقات" : "Disbursements & Payouts", count: payments.length },
          { id: "requests", label: isAr ? "طلبات التسبيق" : "Advance Petitions", count: requests.length },
          { id: "commissions", label: isAr ? "عمولات المبيعات" : "Sales Commissions", count: commissions.length },
          { id: "hours", label: isAr ? "الجلسات وساعات العمل" : "Tracked Sessions & Hours", count: workSessions.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeTab === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* SECTION 1: MY SALARY REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-display text-foreground">
              {isAr ? "طلبات التسبيق والصرف المبكر" : "Salary Advance & Early Payout Petitions"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "متابعة طلبات التسبيق على الراتب المقدمة للإدارة لحالات الطوارئ."
                : "Track requests submitted to management for early salary or emergency advances."}
            </p>
          </div>

          <SADAButton
            size="sm"
            variant="outline"
            onClick={handleOpenRequestModal}
            leftIcon={<Plus className="size-3.5" />}
          >
            {isAr ? "طلب جديد" : "New Request"}
          </SADAButton>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
            <Clock className="size-8 text-muted-foreground/50 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-foreground">
              {isAr ? "لا توجد طلبات تسبيق" : "No Salary Requests"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {isAr
                ? "لم تقم بتقديم أي طلبات تسبيق على الراتب حتى الآن."
                : "You haven't submitted any early payout or salary advance requests."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-all text-start"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3 text-primary" />
                        <span>{isAr ? "التاريخ المطلوب:" : "Target Date:"}</span>{" "}
                        <span className="font-semibold text-foreground" dir="ltr">
                          {req.requested_date}
                        </span>
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatCurrency(req.requested_amount)}
                      </div>
                    </div>

                    <div>
                      {req.status === "approved" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> {isAr ? "تمت الموافقة" : "Approved"}
                        </span>
                      ) : req.status === "rejected" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle className="size-3" /> {isAr ? "مرفوض" : "Rejected"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="size-3" /> {isAr ? "قيد المراجعة" : "Pending Review"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/50 text-xs">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                      {isAr ? "السبب:" : "Reason:"}
                    </div>
                    <p className="mt-1 text-foreground font-medium leading-relaxed">
                      "{req.reason}"
                    </p>
                    {req.notes && (
                      <p className="mt-1 text-muted-foreground text-[11px] italic">
                        {isAr ? "ملاحظة:" : "Note:"} {req.notes}
                      </p>
                    )}
                  </div>

                  {req.review_notes && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-muted/50 border border-border/60 text-xs">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                        {isAr ? "ملاحظة قرار الإدارة:" : "Management Decision Note:"}
                      </div>
                      <p className="mt-0.5 text-foreground font-mono text-[11px]">
                        {req.review_notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/40 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                  <span>
                    {isAr ? "تاريخ التقديم:" : "Submitted:"}{" "}
                    <span dir="ltr">{format(parseISO(req.created_at), "yyyy-MM-dd HH:mm")}</span>
                  </span>
                  {req.approved_amount && (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {isAr ? "تم الصرف:" : "Disbursed:"} {formatCurrency(req.approved_amount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* SECTION 2: PAYMENT HISTORY */}
      {activeTab === "payouts" && (
        <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold font-display text-foreground">
            {isAr ? "سجل المدفوعات والمستحقات" : "Disbursement & Payout History"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? "المدفوعات والتسبيقات المعتمدة والمسجلة من قِبل الإدارة المالية."
              : "Verified salary and advance payouts recorded by SADA Finance."}
          </p>
        </div>

        {/* Mobile Payouts List */}
        <div className="block md:hidden space-y-3">
          {payments.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
              <p className="text-muted-foreground font-mono text-xs">
                {isAr ? "لا توجد سجلات صرف مسجلة." : "No payout records found."}
              </p>
            </div>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3 text-start"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border/60 font-semibold uppercase">
                      {p.payment_type === "regular" ? (isAr ? "راتب دوري" : "Regular") :
                       p.payment_type === "advance" ? (isAr ? "تسبيق" : "Advance") :
                       p.payment_type === "bonus" ? (isAr ? "مكافأة" : "Bonus") :
                       (isAr ? "تسوية" : "Adjustment")}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                      {p.payment_date}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" /> {isAr ? "تم الدفع" : "Paid"}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isAr ? "المبلغ المصروف" : "Payout Amount"}
                  </span>
                  <span className="text-base font-bold font-mono text-foreground" dir="ltr">
                    {formatCurrency(p.amount)}
                  </span>
                </div>

                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                      {isAr ? "طريقة الدفع" : "Method"}
                    </span>
                    <span className="text-foreground font-medium text-[11px]">
                      {p.payment_method === "bank_transfer" ? (isAr ? "تحويل بنكي" : "Bank Transfer") :
                       p.payment_method === "cash" ? (isAr ? "نقداً" : "Cash") :
                       p.payment_method === "check" ? (isAr ? "شيك" : "Check") :
                       p.payment_method}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                      {isAr ? "المرجع" : "Ref"}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]" dir="ltr">
                      {p.reference || "—"}
                    </span>
                  </div>
                </div>

                {p.receipt_url && (
                  <div className="pt-2 border-t border-border/40 flex justify-end">
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="size-3" />
                      <span>{isAr ? "عرض الإيصال" : "View Receipt"}</span>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop Payouts Table */}
        <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4 text-start">{isAr ? "تاريخ الصرف" : "Payout Date"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "النوع" : "Type"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "المبلغ" : "Amount"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "طريقة الدفع" : "Payment Method"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "المرجع" : "Reference"}</th>
                  <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-3 px-4 text-end">{isAr ? "الإيصال" : "Receipt"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground font-mono text-xs">
                      {isAr ? "لا توجد سجلات صرف مسجلة." : "No payout records found."}
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap text-start" dir="ltr">
                        {p.payment_date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-start">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border/60 font-semibold uppercase">
                          {p.payment_type === "regular" ? (isAr ? "راتب دوري" : "Regular") :
                           p.payment_type === "advance" ? (isAr ? "تسبيق" : "Advance") :
                           p.payment_type === "bonus" ? (isAr ? "مكافأة" : "Bonus") :
                           (isAr ? "تسوية" : "Adjustment")}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-foreground whitespace-nowrap text-start">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap font-mono text-[11px] text-start">
                        {p.payment_method === "bank_transfer" ? (isAr ? "تحويل بنكي" : "Bank Transfer") :
                         p.payment_method === "cash" ? (isAr ? "نقداً" : "Cash") :
                         p.payment_method === "check" ? (isAr ? "شيك" : "Check") :
                         p.payment_method}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap text-[11px] text-start" dir="ltr">
                        {p.reference || "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-start">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-3" /> {isAr ? "تم الدفع" : "Paid"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        {p.receipt_url ? (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-block"
                            title={isAr ? "عرض الإيصال" : "View Receipt"}
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40 font-mono text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* TAB 3: SALES COMMISSIONS */}
      {activeTab === "commissions" && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-base font-bold font-display text-foreground">
              {isAr ? "عمولات الصفقات" : "Deal Commissions"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "عمولات مباشرة مرتبطة بالصفقات المغلقة وفواتير الخدمات المسددة."
                : "Direct commissions tied to closed client deals and paid service invoices."}
            </p>
          </div>

          {/* Mobile Commissions List */}
          <div className="block md:hidden space-y-3">
            {commissions.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
                <p className="text-muted-foreground font-mono text-xs">
                  {isAr ? "لا توجد سجلات عمولات." : "No commission records found."}
                </p>
              </div>
            ) : (
              commissions.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3 text-start"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-medium text-muted-foreground" dir="ltr">
                      {c.period_month || (isAr ? "الحالي" : "Current")}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full capitalize ${
                      c.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : c.status === "approved"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {c.status === "paid" ? (isAr ? "مدفوعة" : "Paid") :
                       c.status === "approved" ? (isAr ? "معتمدة" : "Approved") :
                       (isAr ? "معلقة" : "Pending")}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isAr ? "مبلغ العمولة" : "Commission Amount"}
                    </span>
                    <span className="text-base font-bold font-mono text-foreground" dir="ltr">
                      {formatCurrency(c.commission_amount || 0)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        {isAr ? "إيراد الخدمة" : "Service Revenue"}
                      </span>
                      <span className="font-mono text-foreground text-[11px]" dir="ltr">
                        {formatCurrency(c.service_revenue || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        {isAr ? "النسبة" : "Rate"}
                      </span>
                      <span className="font-mono font-semibold text-primary text-[11px]" dir="ltr">
                        {c.commission_rate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Commissions Table */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4 text-start">{isAr ? "الفترة" : "Period"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "إيراد الخدمة" : "Service Revenue"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "النسبة" : "Rate"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "مبلغ العمولة" : "Commission Amount"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {commissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground font-mono text-xs">
                        {isAr ? "لا توجد سجلات عمولات." : "No commission records found."}
                      </td>
                    </tr>
                  ) : (
                    commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap text-start" dir="ltr">
                          {c.period_month || (isAr ? "الحالي" : "Current")}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground whitespace-nowrap text-start">
                          {formatCurrency(c.service_revenue || 0)}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-primary whitespace-nowrap text-start" dir="ltr">
                          {c.commission_rate}%
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-foreground whitespace-nowrap text-start">
                          {formatCurrency(c.commission_amount || 0)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-start">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full capitalize ${
                            c.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : c.status === "approved"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}>
                            {c.status === "paid" ? (isAr ? "مدفوعة" : "Paid") :
                             c.status === "approved" ? (isAr ? "معتمدة" : "Approved") :
                             (isAr ? "معلقة" : "Pending")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRACKED SESSIONS & HOURS */}
      {activeTab === "hours" && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-base font-bold font-display text-foreground">
              {isAr ? "سجل جلسات وساعات العمل" : "Work Sessions & Hours Log"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "ساعات الإنتاج المخصصة لمخرجات العملاء مقابل المهام الإدارية الداخلية."
                : "Production hours dedicated to client deliverables vs. internal administrative tasks."}
            </p>
          </div>

          {/* Mobile Work Sessions List */}
          <div className="block md:hidden space-y-3">
            {workSessions.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-border/80 bg-card/40 text-center">
                <p className="text-muted-foreground font-mono text-xs">
                  {isAr ? "لم يتم تسجيل أي جلسات عمل حتى الآن." : "No work sessions recorded yet."}
                </p>
              </div>
            ) : (
              workSessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2.5 text-start"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                      {format(parseISO(s.started_at), "yyyy-MM-dd HH:mm")}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                      s.status === "completed"
                        ? "bg-muted text-foreground"
                        : "bg-emerald-500/10 text-emerald-600 animate-pulse font-bold"
                    }`}>
                      {s.status === "completed" ? (isAr ? "مكتملة" : "Completed") : (isAr ? "جارية" : "Active")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                      s.session_type === "production"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}>
                      {s.session_type === "production" ? (isAr ? "إنتاج" : "Production") : (isAr ? "إداري" : "Administrative")}
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground" dir="ltr">
                      {s.duration_minutes
                        ? (isAr ? `${s.duration_minutes} د (${(s.duration_minutes / 60).toFixed(1)} س)` : `${s.duration_minutes}m (${(s.duration_minutes / 60).toFixed(1)}h)`)
                        : (isAr ? "نشطة" : "Active")}
                    </span>
                  </div>

                  {s.description && (
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-xl">
                      {s.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Work Sessions Table */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4 text-start">{isAr ? "التاريخ / الوقت" : "Date / Time"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "نوع الجلسة" : "Session Type"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "المدة" : "Duration"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "الوصف" : "Description"}</th>
                    <th className="py-3 px-4 text-start">{isAr ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {workSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground font-mono text-xs">
                        {isAr ? "لم يتم تسجيل أي جلسات عمل حتى الآن." : "No work sessions recorded yet."}
                      </td>
                    </tr>
                  ) : (
                    workSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap text-start" dir="ltr">
                          {format(parseISO(s.started_at), "yyyy-MM-dd HH:mm")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-start">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                            s.session_type === "production"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}>
                            {s.session_type === "production" ? (isAr ? "إنتاج" : "Production") : (isAr ? "إداري" : "Administrative")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold font-mono text-foreground whitespace-nowrap text-start">
                          {s.duration_minutes
                            ? (isAr ? `${s.duration_minutes} د (${(s.duration_minutes / 60).toFixed(1)} س)` : `${s.duration_minutes}m (${(s.duration_minutes / 60).toFixed(1)}h)`)
                            : (isAr ? "نشطة" : "Active")}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-xs text-start">
                          {s.description || (isAr ? "عمل عام" : "General Work")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-start">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                            s.status === "completed"
                              ? "bg-muted text-foreground"
                              : "bg-emerald-500/10 text-emerald-600 animate-pulse font-bold"
                          }`}>
                            {s.status === "completed" ? (isAr ? "مكتملة" : "Completed") : (isAr ? "جارية" : "Active")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST EARLY PAYMENT MODAL */}
      <SADADialog
        open={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
        size="compact"
        title={isAr ? "طلب تسبيق على الراتب" : "Request Early Salary / Advance"}
        description={
          verification.isValid
            ? (isAr ? `الحد المتاح للتسبيق: حتى ${formatCurrency(maxAdvanceAmount)} من راتبك الأساسي الشهري.` : `Eligible advance limit: Up to ${formatCurrency(maxAdvanceAmount)} of your base monthly salary.`)
            : (isAr ? `الحد المتاح للتسبيق: حتى ${maxAdvancePercent}% من راتبك الأساسي الشهري.` : `Eligible advance limit: Up to ${maxAdvancePercent}% of your base monthly salary.`)
        }
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4 pt-1">
          {/* Profile / Compensation Status Banners */}
          {!verification.isValid && verification.userMessage && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5 text-start">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{verification.title}</p>
                <p className="text-[11px] mt-0.5 opacity-90">{verification.userMessage}</p>
              </div>
            </div>
          )}

          {verification.isValid && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">{isAr ? "الراتب الشهري الأساسي:" : "Base Monthly Salary:"}</span>
                <span className="font-bold text-foreground font-mono">{formatCurrency(baseSalary)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">{isAr ? `أقصى تسبيق مسموح (${maxAdvancePercent}%):` : `Max Allowed Advance (${maxAdvancePercent}%):`}</span>
                <span className="font-bold text-primary font-mono">{formatCurrency(maxAdvanceAmount)}</span>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 text-start">
              <AlertCircle className="size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                {isAr ? "المبلغ المطلوب (د.ت) *" : "Requested Amount (TND) *"}
              </label>
              <SADAInput
                type="number"
                step="0.001"
                min="1"
                max={verification.isValid ? maxAdvanceAmount : undefined}
                required
                disabled={!verification.isValid}
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder={verification.isValid ? `${isAr ? "الحد الأقصى" : "Max"} ${maxAdvanceAmount.toFixed(3)}` : (isAr ? "غير متاح" : "Unavailable")}
                prefix={isAr ? "د.ت" : "TND"}
                className="font-mono text-sm"
              />
              <span className="text-[10px] text-muted-foreground font-mono block mt-1">
                {verification.isValid ? (
                  parseFloat(requestedAmount) > maxAdvanceAmount ? (
                    <span className="text-rose-500 font-semibold font-mono">
                      {isAr ? `يتجاوز حد ${maxAdvancePercent}% (${formatCurrency(maxAdvanceAmount)} كحد أقصى)` : `Exceeds ${maxAdvancePercent}% limit (${formatCurrency(maxAdvanceAmount)} max)`}
                    </span>
                  ) : (
                    isAr ? `الحد المتاح للتسبيق: حتى ${formatCurrency(maxAdvanceAmount)} (${maxAdvancePercent}%)` : `Eligible advance limit: Up to ${formatCurrency(maxAdvanceAmount)} (${maxAdvancePercent}%)`
                  )
                ) : (
                  verification.userMessage || (isAr ? "ملف التعويضات مطلوب" : "Compensation profile required")
                )}
              </span>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
                {isAr ? "مطلوب بحلول تاريخ *" : "Needed By Date *"}
              </label>
              <SADADatePicker
                value={format(requestedDate, "yyyy-MM-dd")}
                onChange={(dStr) => dStr && setRequestedDate(parseISO(dStr))}
                disabled={!verification.isValid}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
              {isAr ? "السبب *" : "Reason *"}
            </label>
            <SADAInput
              required
              disabled={!verification.isValid}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isAr ? "مثال: تسبيق شخصي، نفقات طارئة، مصاريف تنقل" : "e.g. Personal advance, emergency expense, transport outlay"}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-mono font-semibold text-muted-foreground block mb-1">
              {isAr ? "ملاحظات اختيارية للإدارة" : "Optional Notes to Management"}
            </label>
            <SADATextarea
              disabled={!verification.isValid}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? "أضف أي تفاصيل إضافية أو تفضيل لآلية الخصم من الراتب القادم" : "Provide any additional context or deduction preference"}
              rows={3}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <SADAButton
              type="button"
              variant="outline"
              onClick={() => setIsRequestModalOpen(false)}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              type="submit"
              variant="primary"
              disabled={
                !verification.isValid ||
                isSubmitting ||
                !requestedAmount ||
                parseFloat(requestedAmount) <= 0 ||
                parseFloat(requestedAmount) > maxAdvanceAmount
              }
              isLoading={isSubmitting}
            >
              {isSubmitting ? (isAr ? "جارٍ الإرسال..." : "Submitting...") : (isAr ? "إرسال الطلب" : "Submit Request")}
            </SADAButton>
          </div>
        </form>
      </SADADialog>
    </div>
  );
}
