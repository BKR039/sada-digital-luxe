import React from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OperationsIntelligenceData } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";
import {
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Flame,
  ArrowUpRight,
  ShieldAlert,
  Film,
  Calendar,
  AlertOctagon,
  Eye,
  Send,
  Zap,
} from "lucide-react";

interface OperationsIntelligenceViewProps {
  data: OperationsIntelligenceData;
  onOpenDrillDown?: (metricType: string, label: string, value: string | number) => void;
}

export function OperationsIntelligenceView({
  data,
  onOpenDrillDown,
}: OperationsIntelligenceViewProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const {
    activeClientsCount,
    activeProjectsCount,
    tasksDueTodayCount,
    overdueTasksCount,
    upcomingDeadlinesCount,
    deliveryCompletionRatePercent,
    blockedTasksCount,
    awaitingReviewCount,
    awaitingPublicationCount,
    pipelineStages,
    teamWorkload,
    clientsAtRisk,
  } = data;

  const pipeline = [
    { label: isAr ? "مخطط / مسودة" : "Planned", count: pipelineStages.planned, color: "bg-muted text-muted-foreground border-border", stageKey: "planned" },
    { label: isAr ? "قيد الإنتاج والتصوير" : "In Production", count: pipelineStages.inProduction, color: "bg-blue-500/10 text-blue-500 border-blue-500/20", stageKey: "in_production" },
    { label: isAr ? "قيد المراجعة والمونتاج" : "In Review", count: pipelineStages.inReview, color: "bg-amber-500/10 text-amber-500 border-amber-500/20", stageKey: "in_review" },
    { label: isAr ? "معتمد للنشر" : "Approved", count: pipelineStages.approved, color: "bg-purple-500/10 text-purple-500 border-purple-500/20", stageKey: "approved" },
    { label: isAr ? "منجز ومسلم" : "Delivered", count: pipelineStages.delivered, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", stageKey: "delivered" },
  ];

  return (
    <section aria-label="Operations Intelligence" className="space-y-4 text-start font-mono">
      {/* 1. EXECUTIVE ACTION BAR */}
      <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            {isAr ? "إجراءات العمليات الفورية:" : "Executive Operations Actions:"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenDrillDown?.("overdue_tasks", isAr ? "المهام المتأخرة" : "Overdue Tasks", overdueTasksCount)}
            className={`h-7 text-[11px] gap-1 px-2.5 ${overdueTasksCount > 0 ? "border-rose-500/40 text-rose-500 hover:bg-rose-500/10" : ""}`}
          >
            <Clock className="size-3" />
            <span>{isAr ? `معالجة المتأخرات (${overdueTasksCount})` : `Resolve Overdue (${overdueTasksCount})`}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenDrillDown?.("blocked_tasks", isAr ? "المهام المعطلة" : "Blocked Tasks", blockedTasksCount)}
            className={`h-7 text-[11px] gap-1 px-2.5 ${blockedTasksCount > 0 ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10" : ""}`}
          >
            <AlertOctagon className="size-3" />
            <span>{isAr ? `فحص المعطل (${blockedTasksCount})` : `Review Blocked (${blockedTasksCount})`}</span>
          </Button>

          <Link to="/admin/team-workload">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 px-2.5 hover:bg-primary/10 hover:text-primary"
            >
              <Users className="size-3" />
              <span>{isAr ? "توزيع عبء الفريق" : "Inspect Workload"}</span>
            </Button>
          </Link>

          <Link to="/admin/packages">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 px-2.5 hover:bg-primary/10 hover:text-primary"
            >
              <Briefcase className="size-3" />
              <span>{isAr ? "التزامات الباقات" : "Delivery Commitments"}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. OPERATIONAL PIPELINE & WORKFLOW PROGRESSION */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-primary" />
              <h3 className="font-bold text-sm font-heading text-foreground">
                {isAr ? "مسار العمليات والإنتاج التشغيلي" : "Operational Delivery Pipeline"}
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isAr
                ? `المشاريع النشطة: ${activeProjectsCount} • حسابات العملاء المباشرة: ${activeClientsCount} • معدل الإنجاز: ${deliveryCompletionRatePercent}%`
                : `Active Projects: ${activeProjectsCount} • Active Accounts: ${activeClientsCount} • Completion: ${deliveryCompletionRatePercent}%`}
            </p>
          </div>

          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/20 bg-primary/5 self-start sm:self-auto">
            {isAr ? `معدل الإنجاز ${deliveryCompletionRatePercent}%` : `${deliveryCompletionRatePercent}% Completion Rate`}
          </Badge>
        </div>

        {/* 5-Stage Visual Workflow Pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {pipeline.map((stage, i) => (
            <div
              key={i}
              onClick={() => onOpenDrillDown?.("delivery_health", `${stage.label} Deliverables`, stage.count)}
              className={`p-3 rounded-xl border flex flex-col justify-between ${stage.color} cursor-pointer transition-transform hover:scale-[1.02] shadow-2xs`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium truncate pe-1">{stage.label}</span>
                <span className="text-[10px] opacity-70">P{i + 1}</span>
              </div>
              <div className="text-xl font-bold mt-2">
                {stage.count}
              </div>
            </div>
          ))}
        </div>

        {/* Operational Pulse Secondary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-border/40 text-xs">
          <div
            onClick={() => onOpenDrillDown?.("today_tasks", isAr ? "مهام اليوم" : "Tasks Due Today", tasksDueTodayCount)}
            className="p-2 rounded-xl bg-muted/20 border border-border/50 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "مهام اليوم" : "Due Today"}</span>
            <span className="font-bold text-foreground text-sm">{tasksDueTodayCount}</span>
          </div>

          <div
            onClick={() => onOpenDrillDown?.("overdue_tasks", isAr ? "مهام متأخرة" : "Overdue Tasks", overdueTasksCount)}
            className={`p-2 rounded-xl border cursor-pointer transition-colors ${
              overdueTasksCount > 0 ? "bg-rose-500/5 border-rose-500/30 text-rose-500" : "bg-muted/20 border-border/50 text-foreground"
            }`}
          >
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "متأخرة" : "Overdue"}</span>
            <span className="font-bold text-sm">{overdueTasksCount}</span>
          </div>

          <div className="p-2 rounded-xl bg-muted/20 border border-border/50">
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "مواعيد 7 أيام" : "Next 7 Days"}</span>
            <span className="font-bold text-foreground text-sm">{upcomingDeadlinesCount}</span>
          </div>

          <div
            onClick={() => onOpenDrillDown?.("blocked_tasks", isAr ? "مهام معطلة" : "Blocked Tasks", blockedTasksCount)}
            className={`p-2 rounded-xl border cursor-pointer transition-colors ${
              blockedTasksCount > 0 ? "bg-amber-500/5 border-amber-500/30 text-amber-500" : "bg-muted/20 border-border/50 text-foreground"
            }`}
          >
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "معطلة" : "Blocked"}</span>
            <span className="font-bold text-sm">{blockedTasksCount}</span>
          </div>

          <div className="p-2 rounded-xl bg-muted/20 border border-border/50">
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "قيد المراجعة" : "In Review"}</span>
            <span className="font-bold text-foreground text-sm">{awaitingReviewCount}</span>
          </div>

          <div className="p-2 rounded-xl bg-muted/20 border border-border/50">
            <span className="text-[10px] text-muted-foreground block truncate">{isAr ? "جاهز للنشر" : "Ready to Publish"}</span>
            <span className="font-bold text-foreground text-sm">{awaitingPublicationCount}</span>
          </div>
        </div>
      </div>

      {/* 3. AT-RISK CLIENTS & TEAM WORKLOAD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* At-Risk Clients */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-500" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                {isAr ? "العملاء المهددون بتعثر التسليم" : "Clients at Risk"}
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px] border-border">
              {clientsAtRisk.length} {isAr ? "عميل" : "Accounts"}
            </Badge>
          </div>

          {clientsAtRisk.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
              {isAr ? "كافة التزامات العملاء في مسارها المحدد دون تأخير" : "All client commitments on schedule"}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {clientsAtRisk.slice(0, 5).map((cl, i) => (
                <Link
                  key={i}
                  to={`/admin/client-workspaces/${cl.clientId}` as any}
                  className="p-2.5 rounded-xl bg-muted/30 hover:bg-muted/70 border border-border/50 flex items-center justify-between transition-colors group block"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors">
                      {cl.name}
                    </span>
                    <span className="text-[11px] text-amber-500 dark:text-amber-400">
                      {cl.reason}
                    </span>
                  </div>
                  <ArrowUpRight className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Team Workload Distribution */}
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                {isAr ? "توزيع عبء العمل على الفريق" : "Team Workload & Capacity"}
              </h4>
            </div>
            <Link
              to="/admin/team-workload"
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              <span>{isAr ? "إدارة الفريق" : "Manage Team"}</span>
              <ArrowUpRight className="size-2.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="space-y-2 text-xs max-h-56 overflow-y-auto pe-1">
            {teamWorkload.slice(0, 6).map((m, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground truncate">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">({m.role})</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {m.assignedCount} {isAr ? "مهام نشطة" : "active tasks"} • {m.actualHours}h {isAr ? "مسجلة" : "logged"}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${
                    m.status === "overloaded"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : m.status === "underutilized"
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  }`}
                >
                  {m.status === "overloaded"
                    ? isAr ? "ضغط عمل" : "Overloaded"
                    : m.status === "underutilized"
                    ? isAr ? "طاقة متاحة" : "Available"
                    : isAr ? "متوازن" : "Balanced"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
