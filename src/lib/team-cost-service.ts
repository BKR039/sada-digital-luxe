// ============================================================
// SADA OS — PHASE 5 & 6: TEAM, TIME & COST ENGINE
// Authoritative Compensation, Time Tracking, Work Sessions &
// Cross-Module Financial OS Convergence
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import {
  formatCurrency,
  type SalaryRecord,
  type SalaryPayment,
  type SalaryRequest,
  type FinancialAllocation,
  type FinancialCurrency,
} from "@/types/finance";
import { logFinancialAction } from "@/lib/finance-service";
import { emitNotification } from "@/lib/notification-service";
import { logSystemAudit } from "@/lib/audit-service";
import { getBusinessRuleNumber } from "@/lib/business-rules-service";

export type SessionType = "production" | "administrative";
export type WorkSessionStatus = "active" | "completed" | "cancelled";

export interface WorkSessionRow {
  id: string;
  team_member_id: string;
  profile_id: string | null;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  description: string | null;
  hourly_cost_rate: number;
  labor_cost: number;
  is_billable: boolean;
  status: WorkSessionStatus;
  created_at: string;
  updated_at: string;
  team_member?: {
    id: string;
    name: string;
    position: string | null;
    photo_url: string | null;
  };
  client?: {
    id: string;
    name: string;
  };
}

// ============================================================
// 1. AUTHORITATIVE COMPENSATION & HOURLY RATE ENGINE
// ============================================================

/**
 * Derives internal employee hourly cost rate from authoritative salary record.
 * Standard monthly working hours = 160 hours (40 hrs/wk * 4 wks).
 * NO manual entry of employee costs.
 */
export function calculateInternalHourlyRate(record: {
  base_amount?: number | null;
  salary_type?: string | null;
  standard_monthly_hours?: number | null;
  hourly_rate?: number | null;
} | null): number {
  if (!record || !record.base_amount) return 0;

  const defaultWorkingHours = getBusinessRuleNumber("standard_monthly_working_hours", 160);
  const base = Number(record.base_amount);
  const type = record.salary_type || "monthly";
  const standardHours = Number(record.standard_monthly_hours || defaultWorkingHours);

  if (record.hourly_rate && Number(record.hourly_rate) > 0) {
    return Number(record.hourly_rate);
  }

  if (type === "hourly") {
    return base;
  }

  if (type === "monthly" || type === "fixed_contract") {
    const hours = standardHours > 0 ? standardHours : defaultWorkingHours;
    return Math.round((base / hours) * 100) / 100;
  }

  return Math.round((base / defaultWorkingHours) * 100) / 100;
}

/**
 * Fetches authoritative compensation rate for a team member.
 */
export async function getTeamMemberHourlyCost(teamMemberId: string): Promise<number> {
  const { data: record, error } = await (supabase as any)
    .from("salary_records")
    .select("base_amount, salary_type, standard_monthly_hours, hourly_rate, status")
    .eq("team_member_id", teamMemberId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !record) return 0;
  return calculateInternalHourlyRate(record);
}

// ============================================================
// 2. TIME TRACKING: CLOCK IN / CLOCK OUT & SESSIONS
// ============================================================

export async function clockIn(params: {
  teamMemberId?: string;
  profileId?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  sessionType?: SessionType;
  description?: string;
}): Promise<{ success: boolean; session?: WorkSessionRow; error?: Error }> {
  try {
    let resolvedMemberId = params.teamMemberId;
    if (!resolvedMemberId && params.profileId) {
      // 1. Try resolving by profile_id
      const { data: member } = await (supabase as any)
        .from("team_members")
        .select("id")
        .or(`profile_id.eq.${params.profileId},user_id.eq.${params.profileId}`)
        .eq("is_active", true)
        .maybeSingle();

      resolvedMemberId = member?.id;
    }

    if (!resolvedMemberId) {
      throw new Error("Your team profile is not configured correctly. Please contact an administrator.");
    }

    const hourlyRate = resolvedMemberId ? await getTeamMemberHourlyCost(resolvedMemberId) : 0;

    const { data: newSession, error } = await (supabase as any)
      .from("work_sessions")
      .insert({
        team_member_id: resolvedMemberId,
        profile_id: params.profileId || null,
        client_id: params.clientId || null,
        project_id: params.projectId || null,
        task_id: params.taskId || null,
        session_type: params.sessionType || "production",
        started_at: new Date().toISOString(),
        duration_minutes: 0,
        description: params.description?.trim() || null,
        hourly_cost_rate: hourlyRate,
        labor_cost: 0,
        status: "active",
      })
      .select("*, team_member:team_members(id, name, position, photo_url)")
      .single();

    if (error) throw error;
    return { success: true, session: newSession };
  } catch (err: any) {
    console.error("[clockIn] Error:", err);
    return { success: false, error: err };
  }
}

export async function clockOut(params: {
  sessionId: string;
  description?: string;
}): Promise<{ success: boolean; session?: WorkSessionRow; error?: Error }> {
  try {
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("work_sessions")
      .select("*")
      .eq("id", params.sessionId)
      .single();

    if (fetchErr || !existing) throw new Error("Work session not found");

    const now = new Date();
    const start = new Date(existing.started_at);
    const durationMs = Math.max(0, now.getTime() - start.getTime());
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const durationHours = durationMinutes / 60.0;
    const hourlyRate = Number(existing.hourly_cost_rate || 0);
    const laborCost = Math.round(durationHours * hourlyRate * 100) / 100;

    const { data: updatedSession, error: updateErr } = await (supabase as any)
      .from("work_sessions")
      .update({
        ended_at: now.toISOString(),
        duration_minutes: durationMinutes,
        labor_cost: laborCost,
        status: "completed",
        description: params.description ? params.description.trim() : existing.description,
        updated_at: now.toISOString(),
      })
      .eq("id", params.sessionId)
      .select("*, team_member:team_members(id, name, position, photo_url)")
      .single();

    if (updateErr) throw updateErr;

    // Propagate to linked task if present
    if (existing.task_id) {
      await propagateTaskHoursAndCost(existing.task_id, durationHours, laborCost);
    }

    return { success: true, session: updatedSession };
  } catch (err: any) {
    console.error("[clockOut] Error:", err);
    return { success: false, error: err };
  }
}

export async function recordDirectWorkSession(params: {
  teamMemberId: string;
  profileId?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  sessionType: SessionType;
  durationMinutes: number;
  description?: string;
  date?: string;
}): Promise<{ success: boolean; session?: WorkSessionRow; error?: Error }> {
  try {
    const hourlyRate = await getTeamMemberHourlyCost(params.teamMemberId);
    const durationMinutes = Math.max(1, Math.round(params.durationMinutes));
    const durationHours = durationMinutes / 60.0;
    const laborCost = Math.round(durationHours * hourlyRate * 100) / 100;

    const baseDate = params.date ? new Date(params.date) : new Date();
    const startedAt = baseDate.toISOString();
    const endedAt = new Date(baseDate.getTime() + durationMinutes * 60000).toISOString();

    const { data: session, error } = await (supabase as any)
      .from("work_sessions")
      .insert({
        team_member_id: params.teamMemberId,
        profile_id: params.profileId || null,
        client_id: params.clientId || null,
        project_id: params.projectId || null,
        task_id: params.taskId || null,
        session_type: params.sessionType,
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        description: params.description?.trim() || null,
        hourly_cost_rate: hourlyRate,
        labor_cost: laborCost,
        status: "completed",
      })
      .select("*, team_member:team_members(id, name, position, photo_url)")
      .single();

    if (error) throw error;

    if (params.taskId) {
      await propagateTaskHoursAndCost(params.taskId, durationHours, laborCost);
    }

    return { success: true, session };
  } catch (err: any) {
    console.error("[recordDirectWorkSession] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Updates task actual hours and propagates labor cost to task row.
 */
export async function propagateTaskHoursAndCost(
  taskId: string,
  addedHours: number,
  addedLaborCost: number
): Promise<void> {
  const { data: task } = await (supabase as any)
    .from("project_tasks")
    .select("actual_hours, labor_cost")
    .eq("id", taskId)
    .single();

  if (task) {
    const newHours = Math.round((Number(task.actual_hours || 0) + addedHours) * 100) / 100;
    const newCost = Math.round((Number(task.labor_cost || 0) + addedLaborCost) * 100) / 100;

    await (supabase as any)
      .from("project_tasks")
      .update({
        actual_hours: newHours,
        labor_cost: newCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  }
}

// ============================================================
// 3. WORKER SELF-PORTAL (Strict Isolation)
// Workers see ONLY own salary, commission, hours, requests, payments
// ============================================================

export interface WorkerPersonalPortalData {
  teamMemberId: string | null;
  salaryRecord: SalaryRecord | null;
  hourlyRate: number;
  commissions: any[];
  workSessions: WorkSessionRow[];
  totalProductionMinutes: number;
  totalAdminMinutes: number;
  totalMinutes: number;
  requests: SalaryRequest[];
  payments: SalaryPayment[];
}

export async function fetchWorkerPersonalPortal(userId: string): Promise<WorkerPersonalPortalData> {
  // Resolve member
  const { data: member } = await (supabase as any)
    .from("team_members")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!member?.id) {
    return {
      teamMemberId: null,
      salaryRecord: null,
      hourlyRate: 0,
      commissions: [],
      workSessions: [],
      totalProductionMinutes: 0,
      totalAdminMinutes: 0,
      totalMinutes: 0,
      requests: [],
      payments: [],
    };
  }

  const memberId = member.id;

  const [salRes, commRes, sessRes, reqRes, payRes] = await Promise.all([
    (supabase as any).from("salary_records").select("*").eq("team_member_id", memberId).maybeSingle(),
    (supabase as any).from("sales_commissions").select("*, client:clients(id, name)").eq("team_member_id", memberId).order("created_at", { ascending: false }),
    (supabase as any).from("work_sessions").select("*, client:clients(id, name)").eq("team_member_id", memberId).order("started_at", { ascending: false }),
    (supabase as any).from("salary_requests").select("*").eq("team_member_id", memberId).order("created_at", { ascending: false }),
    (supabase as any).from("salary_payments").select("*").eq("team_member_id", memberId).order("payment_date", { ascending: false }),
  ]);

  const salaryRecord = salRes.data || null;
  const hourlyRate = calculateInternalHourlyRate(salaryRecord);
  const workSessions = sessRes.data || [];

  const totalProductionMinutes = workSessions
    .filter((s: WorkSessionRow) => s.session_type === "production")
    .reduce((sum: number, s: WorkSessionRow) => sum + Number(s.duration_minutes || 0), 0);

  const totalAdminMinutes = workSessions
    .filter((s: WorkSessionRow) => s.session_type === "administrative")
    .reduce((sum: number, s: WorkSessionRow) => sum + Number(s.duration_minutes || 0), 0);

  return {
    teamMemberId: memberId,
    salaryRecord,
    hourlyRate,
    commissions: commRes.data || [],
    workSessions,
    totalProductionMinutes,
    totalAdminMinutes,
    totalMinutes: totalProductionMinutes + totalAdminMinutes,
    requests: reqRes.data || [],
    payments: payRes.data || [],
  };
}

// ============================================================
// 4. SUPER ADMIN: COMPREHENSIVE TEAM MEMBER COST PROFILE
// ============================================================

export interface TeamMemberCostProfile {
  teamMemberId: string;
  name: string;
  email: string | null;
  role: string;
  position: string;
  division: string;
  employmentType: string;
  skills: string[];
  salaryRecord: SalaryRecord | null;
  hourlyCostRate: number;
  commissionRate: number;
  assignedClientsCount: number;
  assignedProjectsCount: number;
  totalProductionHours: number;
  totalAdminHours: number;
  totalHours: number;
  totalLaborCostGenerated: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  revisionsCount: number;
}

export async function fetchTeamMemberCostProfile(teamMemberId: string): Promise<TeamMemberCostProfile | null> {
  const { data: member, error: memErr } = await (supabase as any)
    .from("team_members")
    .select("*")
    .eq("id", teamMemberId)
    .single();

  if (memErr || !member) return null;

  const [salRes, sessRes, tasksRes, clientsRes, projRes] = await Promise.all([
    (supabase as any).from("salary_records").select("*").eq("team_member_id", teamMemberId).maybeSingle(),
    (supabase as any).from("work_sessions").select("duration_minutes, labor_cost, session_type").eq("team_member_id", teamMemberId),
    (supabase as any).from("project_tasks").select("id, status, deadline, revision_count, actual_hours, labor_cost").or(`assignee_id.eq.${member.profile_id || teamMemberId},reviewer_id.eq.${teamMemberId}`),
    (supabase as any).from("clients").select("id").or(`account_manager_id.eq.${member.profile_id || teamMemberId},sales_owner_id.eq.${member.profile_id || teamMemberId},commission_recipient_id.eq.${teamMemberId}`),
    (supabase as any).from("client_projects").select("id").or(`lead_id.eq.${member.profile_id || teamMemberId},followup_owner_id.eq.${member.profile_id || teamMemberId}`),
  ]);

  const salaryRecord = salRes.data || null;
  const hourlyCostRate = calculateInternalHourlyRate(salaryRecord);
  const sessions = sessRes.data || [];
  const tasks = tasksRes.data || [];

  const prodMins = sessions
    .filter((s: any) => s.session_type === "production")
    .reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0), 0);

  const adminMins = sessions
    .filter((s: any) => s.session_type === "administrative")
    .reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0), 0);

  const totalLaborCost = sessions.reduce((sum: number, s: any) => sum + Number(s.labor_cost || 0), 0);

  const completedTasks = tasks.filter((t: any) => t.status === "done" || t.status === "delivered" || t.status === "approved").length;
  const overdueTasks = tasks.filter((t: any) => {
    if (t.status === "done" || t.status === "delivered" || t.status === "approved") return false;
    if (!t.deadline) return false;
    return new Date(t.deadline).getTime() < new Date().getTime();
  }).length;
  const totalRevisions = tasks.reduce((sum: number, t: any) => sum + Number(t.revision_count || 0), 0);

  return {
    teamMemberId: member.id,
    name: member.name,
    email: member.email,
    role: member.role || "worker",
    position: member.position || "Specialist",
    division: member.division || "creative",
    employmentType: member.employment_type || "full_time",
    skills: member.specialties || [],
    salaryRecord,
    hourlyCostRate,
    commissionRate: 15,
    assignedClientsCount: (clientsRes.data || []).length,
    assignedProjectsCount: (projRes.data || []).length,
    totalProductionHours: Math.round((prodMins / 60.0) * 10) / 10,
    totalAdminHours: Math.round((adminMins / 60.0) * 10) / 10,
    totalHours: Math.round(((prodMins + adminMins) / 60.0) * 10) / 10,
    totalLaborCostGenerated: totalLaborCost,
    completedTasksCount: completedTasks,
    overdueTasksCount: overdueTasks,
    revisionsCount: totalRevisions,
  };
}

// ============================================================
// 5. PHASE 6: FINANCIAL OS CROSS-MODULE LEDGER CONVERGENCE
// ============================================================

/**
 * Canonical Chain 1:
 * Invoice Payment -> Income Transaction -> Account Inflow -> Commission Unlocked
 */
export async function settleInvoicePayment(params: {
  invoiceId: string;
  paymentAmount?: number;
  paymentMethod?: string;
  accountId?: string;
  reference?: string;
  notes?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; incomeTransactions: any[]; error?: Error }> {
  try {
    const { data: invoice, error: invErr } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("id", params.invoiceId)
      .single();

    if (invErr || !invoice) throw new Error("Invoice not found");

    const totalAmt = Number(invoice.total_amount || 0);
    const currentPaid = Number(invoice.paid_amount || 0);
    const amountToPay = params.paymentAmount !== undefined ? Number(params.paymentAmount) : (totalAmt - currentPaid);
    const newPaidTotal = currentPaid + amountToPay;
    const newStatus = newPaidTotal >= totalAmt ? "paid" : "partially_paid";
    const paymentDate = format(new Date(), "yyyy-MM-dd");

    // 1. Update invoice
    const { error: updErr } = await (supabase as any)
      .from("invoices")
      .update({
        paid_amount: newPaidTotal,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.invoiceId);

    if (updErr) throw updErr;

    // 2. Post canonical Income Transactions to ledger
    const servicePortion = Number(invoice.service_revenue || 0);
    const sponsoringPortion = Number(invoice.sponsoring_budget || 0);
    const createdTxs: any[] = [];

    // Service Revenue Inflow
    if (servicePortion > 0) {
      const { data: inc1, error: incErr1 } = await (supabase as any)
        .from("income_transactions")
        .insert({
          amount: servicePortion,
          currency: "TND",
          date: paymentDate,
          category: "Client Payment",
          allocation: "client_service",
          client_id: invoice.client_id,
          project_id: invoice.project_id || null,
          invoice_id: invoice.id,
          account_id: params.accountId || null,
          description: `Client payment for ${invoice.invoice_number} (Service Retainer)`,
          payment_method: params.paymentMethod || "Bank Transfer",
          status: "received",
          reference: params.reference || invoice.invoice_number,
          notes: params.notes || null,
          created_by: params.actorId || null,
        })
        .select()
        .single();

      if (!incErr1 && inc1) createdTxs.push(inc1);
    }

    // Sponsoring Collected Inflow
    if (sponsoringPortion > 0) {
      const { data: inc2, error: incErr2 } = await (supabase as any)
        .from("income_transactions")
        .insert({
          amount: sponsoringPortion,
          currency: "TND",
          date: paymentDate,
          category: "Client Payment",
          allocation: "sponsoring_collected",
          client_id: invoice.client_id,
          project_id: invoice.project_id || null,
          invoice_id: invoice.id,
          account_id: params.accountId || null,
          description: `Client payment for ${invoice.invoice_number} (Sponsoring Collected)`,
          payment_method: params.paymentMethod || "Bank Transfer",
          status: "received",
          reference: params.reference || invoice.invoice_number,
          notes: params.notes || null,
          created_by: params.actorId || null,
        })
        .select()
        .single();

      if (!incErr2 && inc2) createdTxs.push(inc2);
    }

    // 3. Update Treasury Account balance if accountId specified
    if (params.accountId) {
      const { data: acc } = await (supabase as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (supabase as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) + amountToPay,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    // 4. Commission Unlock: When invoice is fully paid, approve pending commissions
    if (newStatus === "paid") {
      await (supabase as any)
        .from("sales_commissions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", params.invoiceId)
        .eq("status", "pending");

      await emitNotification({
        eventType: "COMMISSION_APPROVED",
        title: "Sales Commission Approved",
        message: `Commissions for Invoice ${invoice.invoice_number} approved for payout.`,
        category: "finance",
        roleTarget: "super_admin",
        linkUrl: `/admin/finance`,
        entityType: "invoice",
        entityId: invoice.id,
      });
    }

    // 5. Emit payment received notification & system audit
    await emitNotification({
      eventType: "PAYMENT_RECEIVED",
      title: `Payment Received: Invoice ${invoice.invoice_number}`,
      message: `Received ${amountToPay} TND from ${invoice.client?.name || "Client"}. Status: ${newStatus.toUpperCase()}.`,
      category: "billing",
      roleTarget: "admin",
      linkUrl: `/admin/finance`,
      entityType: "invoice",
      entityId: invoice.id,
    });

    await logSystemAudit({
      action: "PAYMENT_EXECUTION",
      entityType: "invoice",
      entityId: invoice.id,
      actorId: params.actorId,
      newValues: { paid_amount: (invoice.paid_amount || 0) + amountToPay, status: newStatus },
    });

    return { success: true, incomeTransactions: createdTxs };
  } catch (err: any) {
    console.error("[settleInvoicePayment] Error:", err);
    return { success: false, incomeTransactions: [], error: err };
  }
}

/**
 * Canonical Chain 2:
 * Commission Payout -> Expense Transaction -> Treasury Outflow
 */
export async function payoutSalesCommission(params: {
  commissionId: string;
  accountId?: string;
  paymentMethod?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; expenseTransaction?: any; error?: Error }> {
  try {
    const { data: comm, error: commErr } = await (supabase as any)
      .from("sales_commissions")
      .select("*, team_member:team_members(name)")
      .eq("id", params.commissionId)
      .single();

    if (commErr || !comm) throw new Error("Commission record not found");

    const amount = Number(comm.commission_amount || 0);

    // 1. Mark commission as paid
    const { error: updErr } = await (supabase as any)
      .from("sales_commissions")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.commissionId);

    if (updErr) throw updErr;

    // 2. Post canonical Expense Transaction
    const { data: exp, error: expErr } = await (supabase as any)
      .from("expense_transactions")
      .insert({
        amount,
        currency: "TND",
        date: format(new Date(), "yyyy-MM-dd"),
        category_name: "Commissions & Bonuses",
        allocation: "commission",
        commission_id: comm.id,
        team_member_id: comm.team_member_id,
        client_id: comm.client_id,
        account_id: params.accountId || null,
        description: `Sales commission payout to ${comm.team_member?.name || "Specialist"} for deal/client`,
        payment_method: params.paymentMethod || "Bank Transfer",
        status: "paid",
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    // 3. Deduct from account balance if accountId specified
    if (params.accountId) {
      const { data: acc } = await (supabase as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (supabase as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) - amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    // 4. System Audit & Notification
    await logSystemAudit({
      action: "PAYMENT_EXECUTION",
      entityType: "sales_commission",
      entityId: comm.id,
      actorId: params.actorId,
      newValues: { amount, status: "paid" },
    });

    await emitNotification({
      eventType: "COMMISSION_APPROVED",
      title: `Commission Disbursed: ${formatCurrency(amount)}`,
      message: `Commission disbursed to ${comm.team_member?.name || "Specialist"}.`,
      category: "finance",
      roleTarget: "worker",
      linkUrl: `/admin/my-salary`,
      entityType: "sales_commission",
      entityId: comm.id,
    });

    return { success: true, expenseTransaction: exp };
  } catch (err: any) {
    console.error("[payoutSalesCommission] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Canonical Chain 3:
 * Sponsoring Purchase -> Expense Transaction -> Sponsoring Margin Recalculation
 */
export async function recordSponsoringPurchase(params: {
  campaignId: string;
  purchaseCostTnd: number;
  foreignAmountUsd?: number;
  exchangeRate?: number;
  accountId?: string;
  paymentMethod?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; expenseTransaction?: any; campaign?: any; error?: Error }> {
  try {
    const { data: camp, error: cErr } = await (supabase as any)
      .from("sponsoring_campaigns")
      .select("*")
      .eq("id", params.campaignId)
      .single();

    if (cErr || !camp) throw new Error("Sponsoring campaign not found");

    const costTnd = Number(params.purchaseCostTnd);
    const budgetTnd = Number(camp.budget_tnd || 0);
    const sponsoringMargin = Math.max(0, budgetTnd - costTnd);

    // 1. Update sponsoring campaign
    const updatePayload: any = {
      purchase_cost_tnd: costTnd,
      margin_tnd: sponsoringMargin,
      updated_at: new Date().toISOString(),
    };
    if (params.foreignAmountUsd !== undefined) {
      updatePayload.usd_amount = params.foreignAmountUsd;
    }
    if (params.exchangeRate !== undefined) {
      updatePayload.purchase_rate = params.exchangeRate;
    }

    const { data: updatedCamp, error: updErr } = await (supabase as any)
      .from("sponsoring_campaigns")
      .update(updatePayload)
      .eq("id", params.campaignId)
      .select()
      .single();

    if (updErr) throw updErr;

    // 2. Post canonical Expense Transaction
    const { data: exp, error: expErr } = await (supabase as any)
      .from("expense_transactions")
      .insert({
        amount: costTnd,
        currency: "TND",
        date: format(new Date(), "yyyy-MM-dd"),
        category_name: "Media & Sponsoring",
        allocation: "sponsoring_purchase",
        sponsoring_campaign_id: camp.id,
        client_id: camp.client_id,
        project_id: camp.project_id || null,
        account_id: params.accountId || null,
        description: `Meta/TikTok Ads Media Purchase for Campaign: ${camp.campaign_name || camp.name || "Campaign"}`,
        payment_method: params.paymentMethod || "Credit Card (Foreign)",
        status: "paid",
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    // 3. Deduct from account balance if accountId specified
    if (params.accountId) {
      const { data: acc } = await (supabase as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (supabase as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) - costTnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    await logSystemAudit({
      action: "EXPENSE_APPROVAL",
      entityType: "sponsoring_campaign",
      entityId: camp.id,
      actorId: params.actorId,
      newValues: { costTnd, sponsoringMargin },
    });

    return { success: true, expenseTransaction: exp, campaign: updatedCamp };
  } catch (err: any) {
    console.error("[recordSponsoringPurchase] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Canonical Chain 4 & 5:
 * Worker Request Approval -> Payment Execution -> Expense Transaction
 */
export async function executeSalaryPaymentTransaction(params: {
  teamMemberId: string;
  amount: number;
  salaryRequestId?: string;
  salaryRecordId?: string;
  paymentType?: "regular" | "advance" | "bonus" | "adjustment";
  paymentMethod?: string;
  accountId?: string;
  periodStart?: string;
  periodEnd?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; salaryPayment?: any; expenseTransaction?: any; error?: Error }> {
  try {
    const paymentDate = format(new Date(), "yyyy-MM-dd");
    const amount = Number(params.amount);

    // 1. Create Salary Payment
    const { data: payment, error: payErr } = await (supabase as any)
      .from("salary_payments")
      .insert({
        team_member_id: params.teamMemberId,
        salary_record_id: params.salaryRecordId || null,
        salary_request_id: params.salaryRequestId || null,
        amount,
        currency: "TND",
        payment_date: paymentDate,
        payment_type: params.paymentType || (params.salaryRequestId ? "advance" : "regular"),
        payment_method: params.paymentMethod || "Bank Transfer",
        status: "paid",
        created_by: params.actorId || null,
      })
      .select("*, team_member:team_members(name)")
      .single();

    if (payErr) throw payErr;

    // 2. If linked to request, update request to approved
    if (params.salaryRequestId) {
      await (supabase as any)
        .from("salary_requests")
        .update({
          status: "approved",
          approved_amount: amount,
          salary_payment_id: payment.id,
          reviewed_by: params.actorId || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.salaryRequestId);
    }

    // 3. Post canonical Expense Transaction ONLY upon execution
    const { data: exp, error: expErr } = await (supabase as any)
      .from("expense_transactions")
      .insert({
        amount,
        currency: "TND",
        date: paymentDate,
        category_name: "Team & Payroll",
        allocation: "payroll",
        salary_payment_id: payment.id,
        team_member_id: params.teamMemberId,
        account_id: params.accountId || null,
        description: `Salary payout (${params.paymentType || "regular"}) to ${payment.team_member?.name || "Specialist"}`,
        payment_method: params.paymentMethod || "Bank Transfer",
        status: "paid",
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    // 4. Deduct from account balance if accountId specified
    if (params.accountId) {
      const { data: acc } = await (supabase as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (supabase as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) - amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    // 5. System Audit & Notification
    await logSystemAudit({
      action: "PAYMENT_EXECUTION",
      entityType: "salary_payment",
      entityId: payment.id,
      actorId: params.actorId,
      newValues: { amount, team_member_id: params.teamMemberId },
    });

    await emitNotification({
      eventType: "SALARY_PAID",
      title: `Salary Payment Disbursed: ${formatCurrency(amount)}`,
      message: `Payment (${params.paymentType || "regular"}) recorded for ${payment.team_member?.name || "Specialist"}.`,
      category: "finance",
      roleTarget: "worker",
      linkUrl: `/admin/my-salary`,
      entityType: "salary_payment",
      entityId: payment.id,
    });

    return { success: true, salaryPayment: payment, expenseTransaction: exp };
  } catch (err: any) {
    console.error("[executeSalaryPaymentTransaction] Error:", err);
    return { success: false, error: err };
  }
}
