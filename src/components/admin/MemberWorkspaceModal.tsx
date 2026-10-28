import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  X, User, Briefcase, Mail, CheckCircle2, Clock, AlertTriangle,
  AlertCircle, ArrowUpRight, FolderKanban, ShieldCheck, Coins,
  TrendingUp, Award, Layers, Activity, Sparkles, Building2
} from "lucide-react";
import { isToday, parseISO, format } from "date-fns";
import {
  isTaskOverdue, STATUS_CONFIG, PRIORITY_CONFIG,
  type TaskRow, type ProjectRow, type TeamMemberRow
} from "@/components/admin/project-utils";
import { useAuth } from "@/lib/auth";
import { fetchTeamMemberCostProfile, type TeamMemberCostProfile } from "@/lib/team-cost-service";
import { formatCurrency } from "@/types/finance";

interface Props {
  member: TeamMemberRow;
  tasks: TaskRow[];
  projects: ProjectRow[];
  onEditTask: (task: TaskRow) => void;
  onClose: () => void;
}

export function MemberWorkspaceModal({ member, tasks, projects, onEditTask, onClose }: Props) {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [costProfile, setCostProfile] = useState<TeamMemberCostProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const memberId = member.id;
  const profileId = member.profile_id;

  useEffect(() => {
    let isMounted = true;
    if (memberId) {
      setLoadingProfile(true);
      fetchTeamMemberCostProfile(memberId)
        .then((profile) => {
          if (isMounted) {
            setCostProfile(profile);
            setLoadingProfile(false);
          }
        })
        .catch((err) => {
          console.error("Error fetching cost profile:", err);
          if (isMounted) setLoadingProfile(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [memberId]);

  // Filter tasks assigned to this member (matching member.id or member.profile_id)
  const memberTasks = tasks.filter(
    (t) => t.assignee_id === memberId || (profileId && t.assignee_id === profileId)
  );

  const activeTasks = memberTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const inProgressTasks = activeTasks.filter((t) => t.status === "in_progress");
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t));
  const blockedTasks = activeTasks.filter((t) => t.status === "blocked");
  const completedTasks = memberTasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at || b.updated_at).localeCompare(a.completed_at || a.updated_at))
    .slice(0, 5);

  // Projects where member has tasks or is followup owner
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberProjectIds = new Set(memberTasks.map((t) => t.project_id));
  const activeProjects = projects.filter(
    (p) =>
      memberProjectIds.has(p.id) ||
      p.followup_owner_id === memberId ||
      (profileId && p.followup_owner_id === profileId)
  );

  const employmentTypeLabel: Record<string, string> = {
    full_time: "Full-Time Employee",
    part_time: "Part-Time",
    freelance: "Freelancer / Contract",
    intern: "Intern",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/45 dark:bg-black/65 animate-[sada-overlay-in_150ms_ease-out]">
      <div className="relative w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl overflow-hidden flex flex-col animate-[sada-drawer-in-right_180ms_ease-out]">
        {/* Workspace Header */}
        <div className="p-6 border-b border-border bg-muted/20 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {member.photo_url ? (
              <img
                src={member.photo_url}
                alt={member.name}
                className="size-16 rounded-2xl object-cover ring-2 ring-border shrink-0"
              />
            ) : (
              <span className="size-16 rounded-2xl bg-gradient-primary text-white text-xl font-bold grid place-items-center shrink-0 ring-2 ring-border">
                {member.name[0].toUpperCase()}
              </span>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-2xl font-bold text-foreground">{member.name}</h2>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {member.division}
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground capitalize">
                  {employmentTypeLabel[member.employment_type || costProfile?.employmentType || "full_time"] || "Full-Time"}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary mt-0.5">{member.position}</p>
              {member.email && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Mail className="size-3" /> {member.email}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Operational Metrics Bar */}
        <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/10 text-center py-3 px-2">
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Active Tasks</div>
            <div className="text-lg font-bold text-foreground mt-0.5">{activeTasks.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">In Progress</div>
            <div className="text-lg font-bold text-primary mt-0.5">{inProgressTasks.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Overdue</div>
            <div className={`text-lg font-bold mt-0.5 ${overdueTasks.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {overdueTasks.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Revisions</div>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {costProfile?.revisionsCount ?? 0}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Authoritative Compensation & Cost Intelligence (Super Admin & Admin Only) */}
          {(isAdmin || isSuperAdmin) && (
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Authoritative Compensation & Cost
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Admin Oversight</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Base Remuneration</div>
                  <div className="text-sm font-bold font-display text-foreground mt-0.5">
                    {costProfile?.salaryRecord ? formatCurrency(costProfile.salaryRecord.base_amount) : "Not Set"}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground capitalize">
                    {costProfile?.salaryRecord?.payment_frequency || "Monthly"}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Hourly Cost Rate</div>
                  <div className="text-sm font-bold font-mono text-primary mt-0.5">
                    {costProfile?.hourlyCostRate ? `${costProfile.hourlyCostRate.toFixed(2)} TND/hr` : "0.00 TND/hr"}
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground">Base / 160h</div>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Production Hours</div>
                  <div className="text-sm font-bold font-display text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {costProfile?.totalProductionHours ?? 0} hrs
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground">Client billable</div>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border/80">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Admin Hours</div>
                  <div className="text-sm font-bold font-display text-amber-600 dark:text-amber-400 mt-0.5">
                    {costProfile?.totalAdminHours ?? 0} hrs
                  </div>
                  <div className="text-[9px] font-mono text-muted-foreground">Internal operations</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/10">
                <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                  <Coins className="size-3 text-primary" /> Total Generated Labor Cost:
                </span>
                <span className="font-bold font-mono text-foreground">
                  {formatCurrency(costProfile?.totalLaborCostGenerated ?? 0)}
                </span>
              </div>
            </div>
          )}

          {/* Specialties */}
          {member.specialties && member.specialties.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-muted-foreground mb-2">
                Specialties & Domain
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {member.specialties.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Active Projects */}
          <div>
            <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
              <span>Active Assigned Projects ({activeProjects.length})</span>
            </h3>
            {activeProjects.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {activeProjects.map((p) => {
                  const targetId = p.client_id || p.id;
                  return (
                    <Link
                      key={p.id}
                      to="/admin/client-workspaces/$id"
                      params={{ id: targetId }}
                      onClick={onClose}
                      className="p-3.5 rounded-2xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors group flex items-start justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {p.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{p.client_name}</div>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-xl text-center">
                No active projects assigned currently.
              </p>
            )}
          </div>

          {/* Active Work & Tasks */}
          <div>
            <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
              <span>Active Tasks ({activeTasks.length})</span>
            </h3>

            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map((t) => {
                  const proj = projectMap.get(t.project_id);
                  const statusConf = STATUS_CONFIG[t.status];
                  const priorityConf = PRIORITY_CONFIG[t.priority];
                  const overdue = isTaskOverdue(t);

                  return (
                    <div
                      key={t.id}
                      onClick={() => onEditTask(t)}
                      className={`p-4 rounded-2xl border border-border bg-muted/10 hover:bg-muted/40 cursor-pointer transition-colors space-y-2 ${
                        overdue ? "bg-destructive/5 border-destructive/30" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground truncate">{t.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${priorityConf.color} ${priorityConf.bg}`}
                          >
                            {priorityConf.label}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              overdue ? "text-destructive bg-destructive/10" : statusConf.color
                            }`}
                          >
                            {overdue ? "Overdue" : statusConf.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                        {proj && <span className="font-semibold text-foreground/80">{proj.client_name}</span>}
                        {t.deadline && (
                          <span className={overdue ? "text-destructive font-bold" : ""}>
                            Due: {format(parseISO(t.deadline), "d MMM yyyy")}
                          </span>
                        )}
                        {t.service && <span className="bg-muted px-1.5 py-0.5 rounded">{t.service}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-xl text-center">
                No active tasks assigned to this member.
              </p>
            )}
          </div>

          {/* Recently Completed Work */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-muted-foreground mb-3">
                Recently Completed Work
              </h3>
              <div className="space-y-2">
                {completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-border/60 bg-emerald-500/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-foreground truncate">{t.title}</span>
                    </div>
                    {t.completed_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(parseISO(t.completed_at), "d MMM")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
