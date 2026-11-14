// ============================================================
// SADA OS — RECURRING NOTIFICATION SCHEDULER DAEMON (PUSH 3.0)
// Automated recurring background execution of deadline evaluation,
// overdue invoice alerts, production shoot reminders, and monitoring.
// ============================================================

import { runScheduledReminderScan, type SchedulerScanResult } from "./reminder-scheduler";

export interface SchedulerExecutionRecord {
  runId: string;
  timestamp: string;
  durationMs: number;
  triggeredBy: string;
  success: boolean;
  scannedTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  overdueInvoices: number;
  shootsTomorrow: number;
  notificationsEmitted: number;
  pushesDispatched: number;
  emailsDispatched: number;
  errors: string[];
}

export interface SchedulerDaemonStatus {
  active: boolean;
  intervalMinutes: number;
  nextRunEstimated: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
  lastError: string | null;
  totalRuns: number;
  totalEmitted: number;
  totalPushes: number;
  totalEmails: number;
  recentRuns: SchedulerExecutionRecord[];
}

class NotificationSchedulerDaemon {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 15 * 60 * 1000; // 15 minutes default
  private isExecuting: boolean = false;
  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastStatus: "IDLE" | "RUNNING" | "SUCCESS" | "FAILED" = "IDLE";
  private lastError: string | null = null;
  private totalRuns: number = 0;
  private totalEmitted: number = 0;
  private totalPushes: number = 0;
  private totalEmails: number = 0;
  private history: SchedulerExecutionRecord[] = [];
  private readonly MAX_HISTORY = 20;

  constructor() {
    const envInterval = process.env.SCHEDULER_INTERVAL_MINUTES;
    if (envInterval && !isNaN(Number(envInterval))) {
      this.intervalMs = Math.max(1, Number(envInterval)) * 60 * 1000;
    }
  }

  public start(intervalMinutes?: number) {
    if (this.timer) {
      return; // Already active singleton
    }

    if (intervalMinutes && intervalMinutes > 0) {
      this.intervalMs = intervalMinutes * 60 * 1000;
    }

    console.log(
      `[SchedulerDaemon] Initialized recurring reminder scheduler (Interval: ${this.intervalMs / 60000}m)`
    );

    // Initial run after a short stabilization delay (30 seconds)
    setTimeout(() => {
      this.executeCycle("startup_initialization").catch((e) =>
        console.warn("[SchedulerDaemon] Initial cycle warning:", e.message)
      );
    }, 30000);

    // Recurring interval
    this.timer = setInterval(() => {
      this.executeCycle("recurring_cron").catch((e) =>
        console.warn("[SchedulerDaemon] Scheduled cycle warning:", e.message)
      );
    }, this.intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[SchedulerDaemon] Recurring reminder scheduler stopped.");
    }
  }

  public async executeCycle(
    triggeredBy: string = "manual",
    options?: { authHeader?: string }
  ): Promise<SchedulerExecutionRecord> {
    if (this.isExecuting) {
      const busyRecord: SchedulerExecutionRecord = {
        runId: `run_${Date.now()}`,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        triggeredBy,
        success: false,
        scannedTasks: 0,
        overdueTasks: 0,
        dueSoonTasks: 0,
        overdueInvoices: 0,
        shootsTomorrow: 0,
        notificationsEmitted: 0,
        pushesDispatched: 0,
        emailsDispatched: 0,
        errors: ["Scheduler cycle already executing in another task. Skipping to prevent race conditions."],
      };
      return busyRecord;
    }

    this.isExecuting = true;
    this.lastStatus = "RUNNING";
    this.lastRunAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const scanResult: SchedulerScanResult = await runScheduledReminderScan({
        authHeader: options?.authHeader,
      });

      const durationMs = Date.now() - startTime;
      const isSuccess = scanResult.errors.length === 0;

      const record: SchedulerExecutionRecord = {
        runId: `run_${Date.now()}`,
        timestamp: scanResult.timestamp,
        durationMs,
        triggeredBy,
        success: isSuccess,
        scannedTasks: scanResult.scannedTasks,
        overdueTasks: scanResult.overdueTasks,
        dueSoonTasks: scanResult.dueSoonTasks,
        overdueInvoices: scanResult.overdueInvoices,
        shootsTomorrow: scanResult.shootsTomorrow,
        notificationsEmitted: scanResult.notificationsEmitted,
        pushesDispatched: scanResult.pushesDispatched,
        emailsDispatched: scanResult.emailsDispatched,
        errors: scanResult.errors,
      };

      this.totalRuns++;
      this.totalEmitted += scanResult.notificationsEmitted;
      this.totalPushes += scanResult.pushesDispatched;
      this.totalEmails += scanResult.emailsDispatched;

      if (isSuccess) {
        this.lastStatus = "SUCCESS";
        this.lastSuccessAt = new Date().toISOString();
        this.lastError = null;
      } else {
        this.lastStatus = "FAILED";
        this.lastError = scanResult.errors.join("; ");
      }

      this.recordHistory(record);
      return record;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.lastStatus = "FAILED";
      this.lastError = err?.message || "Execution exception";

      const failedRecord: SchedulerExecutionRecord = {
        runId: `run_${Date.now()}`,
        timestamp: new Date().toISOString(),
        durationMs,
        triggeredBy,
        success: false,
        scannedTasks: 0,
        overdueTasks: 0,
        dueSoonTasks: 0,
        overdueInvoices: 0,
        shootsTomorrow: 0,
        notificationsEmitted: 0,
        pushesDispatched: 0,
        emailsDispatched: 0,
        errors: [err?.message || "Unhandled scheduler exception"],
      };

      this.totalRuns++;
      this.recordHistory(failedRecord);
      return failedRecord;
    } finally {
      this.isExecuting = false;
    }
  }

  public getStatus(): SchedulerDaemonStatus {
    const nextEstimated = this.timer && this.lastRunAt
      ? new Date(new Date(this.lastRunAt).getTime() + this.intervalMs).toISOString()
      : null;

    return {
      active: Boolean(this.timer),
      intervalMinutes: Math.round(this.intervalMs / 60000),
      nextRunEstimated: nextEstimated,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastStatus: this.lastStatus,
      lastError: this.lastError,
      totalRuns: this.totalRuns,
      totalEmitted: this.totalEmitted,
      totalPushes: this.totalPushes,
      totalEmails: this.totalEmails,
      recentRuns: [...this.history],
    };
  }

  private recordHistory(record: SchedulerExecutionRecord) {
    this.history.unshift(record);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }
  }
}

// Global Singleton Daemon
const globalDaemonKey = Symbol.for("sada.scheduler.daemon");
const globalObj = globalThis as any;

if (!globalObj[globalDaemonKey]) {
  globalObj[globalDaemonKey] = new NotificationSchedulerDaemon();
}

export const schedulerDaemon: NotificationSchedulerDaemon = globalObj[globalDaemonKey];
export const startSchedulerDaemon = (intervalMinutes?: number) => schedulerDaemon.start(intervalMinutes);
export const stopSchedulerDaemon = () => schedulerDaemon.stop();
export const getSchedulerDaemonStatus = () => schedulerDaemon.getStatus();
export const triggerSchedulerNow = (options?: { triggeredBy?: string; authHeader?: string }) =>
  schedulerDaemon.executeCycle(options?.triggeredBy || "manual_trigger", options);
