import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonMetric,
  SkeletonTable,
  SkeletonChart,
  SkeletonPageHeader,
} from "./sada-skeleton";

// ============================================================================
// 1. EXECUTIVE DASHBOARD SKELETON
// ============================================================================

export function ExecutiveDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header & Scope Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-60 sm:w-72 rounded-xl" />
          <Skeleton className="h-3.5 w-full max-w-sm rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-32 sm:w-36 rounded-xl" />
          <Skeleton className="h-9 w-24 sm:w-28 rounded-xl" />
        </div>
      </div>

      {/* 4 Primary Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetric key={i} className="min-h-[120px] sm:min-h-[140px]" />
        ))}
      </div>

      {/* Main Command Center Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Operations & Execution */}
        <div className="lg:col-span-2 space-y-6">
          <SkeletonChart type="bar" height={260} />
          <div className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border bg-card soft-shadow space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-3.5 rounded-2xl border border-border/60 bg-muted/20 flex items-center justify-between gap-3 sm:gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-40 sm:w-48 max-w-full rounded-md" />
                    <Skeleton className="h-3 w-28 sm:w-32 max-w-full rounded-md opacity-80" />
                  </div>
                  <Skeleton className="h-6 w-16 sm:w-20 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Intelligence & Risk Control */}
        <div className="space-y-6">
          <div className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-border bg-card soft-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="size-6 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 sm:p-3.5 rounded-2xl border border-border/60 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-14 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-md opacity-80" />
                </div>
              ))}
            </div>
          </div>
          <SkeletonChart type="donut" height={220} hasLegend={false} />
        </div>
      </div>

      {/* Bottom Table: Activity / Workspaces */}
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}

// ============================================================================
// 2. FINANCE DASHBOARD SKELETON
// ============================================================================

export function FinanceDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("max-w-7xl mx-auto space-y-6 pb-16", className)}
    >
      {/* Finance Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-60 sm:w-64 rounded-xl" />
          <Skeleton className="h-3.5 w-full max-w-sm rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Skeleton className="h-9 w-28 sm:w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 sm:w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 sm:w-28 rounded-xl" />
        </div>
      </div>

      {/* 5 Financial KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonMetric key={i} className="min-h-[120px] sm:min-h-[140px]" />
        ))}
      </div>

      {/* Financial Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto scrollbar-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Financial Ledger & Transactions Table */}
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}

// ============================================================================
// 3. ANALYTICS DASHBOARD SKELETON
// ============================================================================

export function AnalyticsDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("p-3.5 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24", className)}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-8 sm:h-9 w-60 sm:w-72 rounded-xl" />
          <Skeleton className="h-3.5 w-full max-w-sm rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 sm:w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetric key={i} className="min-h-[120px] sm:min-h-[140px]" />
        ))}
      </div>

      {/* Chart & Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonChart type="bar" height={300} />
        </div>
        <div>
          <SkeletonChart type="donut" height={300} />
        </div>
      </div>

      {/* Profitability / Client Ranking Table */}
      <SkeletonTable rows={5} cols={6} />
    </div>
  );
}

// ============================================================================
// 4. SALES PIPELINE / DEALS SKELETON
// ============================================================================

export function SalesPipelineSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-20", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-60 rounded-xl" />
          <Skeleton className="h-3.5 w-72 rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* 4 Pipeline Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetric key={i} className="min-h-[130px]" />
        ))}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Skeleton className="h-9 w-full sm:w-72 rounded-xl" />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Kanban Board Columns (Simulating 5 stage lanes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="p-4 rounded-3xl border border-border bg-card/60 space-y-3 min-w-[260px]"
          >
            {/* Stage Column Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="size-5 rounded-full" />
            </div>

            {/* Deal Cards in Column */}
            <div className="space-y-3">
              {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : 1 }).map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="p-4 rounded-2xl border border-border bg-card soft-shadow space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-20 rounded-md opacity-80" />
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <Skeleton className="h-5 w-20 rounded-lg" />
                    <SkeletonAvatar size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 5. TEAM WORKLOAD SKELETON
// ============================================================================

export function TeamWorkloadSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
          <Skeleton className="h-3.5 w-80 rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 5 Workload Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border bg-card space-y-2">
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-3xl border border-border bg-card soft-shadow space-y-4">
            <div className="flex items-center gap-3">
              <SkeletonAvatar size="md" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md opacity-80" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 6. MY SALARY / COMPENSATION SKELETON
// ============================================================================

export function MySalarySkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("max-w-4xl mx-auto space-y-6 pb-16 px-1 sm:px-0", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-60 rounded-xl" />
          <Skeleton className="h-3.5 w-72 rounded-md opacity-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* 3 Compensation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonMetric key={i} className="min-h-[130px]" />
        ))}
      </div>

      {/* Salary Advance Request Card */}
      <div className="p-6 rounded-3xl border border-border bg-card soft-shadow space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <Skeleton className="h-4 w-44 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-3.5 w-3/4 rounded-md opacity-80" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Salary Payment History Table */}
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}

// ============================================================================
// 7. MY WORK / TIME & TASK SKELETON
// ============================================================================

export function MyWorkSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 sm:h-9 w-52 rounded-xl" />
          <Skeleton className="h-3.5 w-64 rounded-md opacity-80" />
        </div>
        <Skeleton className="h-9 w-44 rounded-xl" />
      </div>

      {/* Stopwatch / Session Engine Card */}
      <div className="p-5 rounded-2xl border border-border bg-card soft-shadow space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md opacity-80" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row justify-between gap-3">
        <Skeleton className="h-9 w-full sm:w-72 rounded-xl" />
        <div className="flex gap-1.5 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Task Queue Cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-border/80 bg-card soft-shadow flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="size-5 rounded-md shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md opacity-80" />
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Skeleton className="h-6 w-16 rounded-md" />
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 8. CLIENT DIRECTORY SKELETON
// ============================================================================

export function ClientDirectorySkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-12", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-8 sm:h-9 w-44 rounded-xl" />
          <Skeleton className="h-3.5 w-64 rounded-md opacity-80" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full lg:w-80 rounded-xl" />
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg shrink-0" />
          ))}
          <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Clients Table */}
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}

// ============================================================================
// 9. CLIENT WORKSPACE SKELETON ($id)
// ============================================================================

export function ClientWorkspaceSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-20", className)}
    >
      {/* Back Link */}
      <Skeleton className="h-4 w-40 rounded-md" />

      {/* Main Workspace Header Card */}
      <div className="p-6 md:p-8 rounded-3xl border border-border bg-card soft-shadow space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <Skeleton className="h-9 sm:h-10 w-72 rounded-2xl" />
            <Skeleton className="h-4 w-48 rounded-md opacity-80" />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* 4 Financial / Operational Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tab Bar (11 tabs) */}
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-3 overflow-x-auto scrollbar-none">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <SkeletonTable rows={4} cols={5} />
        </div>
        <div className="space-y-4">
          <SkeletonCard hasHeader={true}>
            <SkeletonText lines={4} />
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. OPERATIONAL WORKSPACES SKELETON
// ============================================================================

export function WorkspaceListSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-60 rounded-xl" />
          <Skeleton className="h-3.5 w-80 rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Operational Toolbar */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full lg:w-80 rounded-xl" />
        <div className="flex items-center gap-2 overflow-x-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Workspace List Items */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl border border-border bg-card soft-shadow space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-44 rounded-lg" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3.5 w-60 rounded-md opacity-80" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-2 w-32 rounded-full hidden sm:block" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 11. WORKSPACE DETAIL SKELETON ($id)
// ============================================================================

export function WorkspaceDetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-20", className)}
    >
      <Skeleton className="h-4 w-36 rounded-md" />

      {/* Workspace Command Header */}
      <div className="p-6 rounded-3xl border border-border bg-card soft-shadow space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
            <Skeleton className="h-3.5 w-80 rounded-md opacity-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Tasks Table */}
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

// ============================================================================
// 12. ACCOUNTS DIRECTORY SKELETON
// ============================================================================

export function AccountsDirectorySkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
          <Skeleton className="h-3.5 w-80 rounded-md opacity-80" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row justify-between gap-3">
        <Skeleton className="h-9 w-full sm:w-80 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Accounts Table */}
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}

// ============================================================================
// 13. BUSINESS RULES SKELETON
// ============================================================================

export function BusinessRulesSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 max-w-7xl mx-auto pb-16", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-8 sm:h-9 w-72 rounded-xl" />
          <Skeleton className="h-3.5 w-96 rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-lg shrink-0" />
        ))}
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-3xl border border-border bg-card soft-shadow space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-full rounded-md opacity-80" />
            <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 14. NOTIFICATION CENTER SKELETON
// ============================================================================

export function NotificationCenterSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("divide-y divide-border/30", className)}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3.5 flex items-start gap-3">
          <Skeleton className="size-8 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-36 rounded-md" />
              <Skeleton className="h-2.5 w-12 rounded-sm" />
            </div>
            <Skeleton className="h-3 w-56 rounded-md opacity-80" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 15. CALENDAR DASHBOARD SKELETON
// ============================================================================

export function CalendarDashboardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("space-y-6 animate-pulse max-w-7xl mx-auto pb-12", className)}
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-3.5 w-96 rounded-md opacity-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-2xl" />
          <Skeleton className="h-9 w-48 rounded-2xl" />
        </div>
      </div>

      {/* 5 Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3.5 rounded-2xl border border-border bg-card shadow-xs space-y-2">
            <Skeleton className="h-3 w-16 rounded-md" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-10 rounded-md" />
              <Skeleton className="size-4 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar Grid Card */}
        <div className="lg:col-span-8 p-4 md:p-6 rounded-3xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="h-6 w-32 rounded-lg" />
              <Skeleton className="size-8 rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-44 rounded-2xl" />
              <Skeleton className="h-8 w-24 rounded-2xl" />
            </div>
          </div>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded-md" />
            ))}
          </div>
          {/* Calendar Day Grid (5 rows of 7 days) */}
          <div className="grid grid-cols-7 gap-1.5 pt-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right Column: Selected Day & Upcoming Panels */}
        <div className="lg:col-span-4 space-y-6">
          {/* Selected Day Panel */}
          <div className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-4">
            <div className="space-y-1.5 pb-3 border-b border-border/60">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-7 w-48 rounded-xl" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-2xl border border-border/60 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20 rounded-md" />
                    <Skeleton className="h-3 w-14 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Panel */}
          <div className="p-5 rounded-3xl border border-border bg-card shadow-xs space-y-4">
            <div className="space-y-1 pb-3 border-b border-border/60">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/40">
                  <Skeleton className="size-10 rounded-xl shrink-0" />
                  <div className="space-y-1 flex-1 min-w-0">
                    <Skeleton className="h-3.5 w-32 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

