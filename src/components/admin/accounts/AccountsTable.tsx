import { AccountRecord } from "@/lib/account-service";
import { getRoleBadgeStyle } from "@/lib/permissions";
import { format, parseISO } from "date-fns";
import { useTranslation } from "@/i18n";
import {
  MoreVertical,
  Shield,
  ShieldAlert,
  User,
  Clock,
  Calendar,
  Lock,
  RotateCcw,
  Trash2,
  Sliders,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SADAButton } from "@/components/ui/sada-button";

interface AccountsTableProps {
  accounts: AccountRecord[];
  onSelectAccount: (acc: AccountRecord) => void;
  onOpenSuspend: (acc: AccountRecord) => void;
  onOpenReactivate: (acc: AccountRecord) => void;
  onOpenResetPassword: (acc: AccountRecord) => void;
  onOpenDelete: (acc: AccountRecord) => void;
  currentUserId?: string;
}

export function AccountsTable({
  accounts,
  onSelectAccount,
  onOpenSuspend,
  onOpenReactivate,
  onOpenResetPassword,
  onOpenDelete,
  currentUserId,
}: AccountsTableProps) {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";

  const getLocalizedRoleLabel = (role: string, fallback: string) => {
    if (!isAr) return fallback;
    if (role === "super_admin") return "مشرف متميز";
    if (role === "admin") return "مدير نظام";
    if (role === "worker") return "عضو فريق";
    return fallback;
  };

  const getLocalizedDivision = (division?: string | null) => {
    if (!division) return isAr ? "التطوير البرمجي" : "Development";
    if (!isAr) return division;
    const divMap: Record<string, string> = {
      Executive: "الإدارة التنفيذية",
      Development: "التطوير البرمجي",
      Marketing: "التسويق",
      Production: "الإنتاج",
      Design: "التصميم",
    };
    return divMap[division] || division;
  };

  if (accounts.length === 0) {
    return (
      <div className="p-12 text-center border border-border/80 rounded-3xl bg-card soft-shadow">
        <User className="size-10 text-muted-foreground mx-auto mb-3 opacity-60" />
        <h3 className="font-display font-bold text-base text-foreground">
          {isAr ? "لا توجد حسابات تطابق معايير البحث" : "No accounts match your criteria"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {isAr
            ? "جرّب تعديل مصطلحات البحث أو المرشحات للعثور على الحسابات المطلوبة."
            : "Try adjusting your search terms or filters to locate the accounts you are looking for."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl bg-card border border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "هوية الحساب" : "Account Identity"}</th>
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "الدور والصلاحية" : "Role & Access"}</th>
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "الحالة" : "Status"}</th>
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "القسم / المسمى" : "Division / Position"}</th>
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "آخر تسجيل دخول" : "Last Sign In"}</th>
                <th className="py-3 px-4 font-semibold text-start">{isAr ? "تاريخ الإنشاء" : "Created"}</th>
                <th className="py-3 px-4 font-semibold text-end">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {accounts.map((acc) => {
                const roleBadge = getRoleBadgeStyle(acc.role);
                const isSelf = currentUserId === acc.user_id;
                const isSuspended = acc.status === "suspended";

                return (
                  <tr
                    key={acc.user_id}
                    onClick={() => onSelectAccount(acc)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    {/* Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-muted border border-border overflow-hidden shrink-0 grid place-items-center font-display font-bold text-foreground text-xs uppercase shadow-sm">
                          {acc.photo_url ? (
                            <img
                              src={acc.photo_url}
                              alt={acc.display_name}
                              className="size-full object-cover"
                            />
                          ) : (
                            acc.display_name.slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate flex items-center gap-1.5">
                            <span>{acc.display_name}</span>
                            {isSelf && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                {isAr ? "أنت" : "You"}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate font-mono" dir="ltr">
                            {acc.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${roleBadge.badgeClass}`}
                        >
                          <span className={`size-1.5 rounded-full ${roleBadge.dotColor}`} />
                          <span>{getLocalizedRoleLabel(acc.role, roleBadge.label)}</span>
                        </span>
                        {acc.module_permissions && Object.keys(acc.module_permissions).length > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                            <Sliders className="size-2.5 text-primary" />
                            <span>{isAr ? "صلاحيات مخصصة" : "Custom Perms"}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {acc.status === "suspended" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                          {isAr ? "معلق" : "Suspended"}
                        </span>
                      ) : acc.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          {isAr ? "قيد الانتظار" : "Pending"}
                        </span>
                      ) : acc.status === "disabled" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                          <span className="size-1.5 rounded-full bg-slate-500" />
                          {isAr ? "معطل" : "Disabled"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {isAr ? "نشط" : "Active"}
                        </span>
                      )}
                    </td>

                    {/* Division / Position */}
                    <td className="py-3.5 px-4 text-foreground">
                      <div className="font-medium truncate max-w-[160px]">
                        {acc.team_position || (isAr ? "مختص" : "Specialist")}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {getLocalizedDivision(acc.division)}
                      </div>
                    </td>

                    {/* Last Sign In */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                      {acc.last_sign_in_at ? (
                        <div className="flex items-center gap-1" dir="ltr">
                          <Clock className="size-3 text-muted-foreground/70 shrink-0" />
                          <span>{format(parseISO(acc.last_sign_in_at), "MMM d, HH:mm")}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                      {acc.created_at ? (
                        <span dir="ltr">{format(parseISO(acc.created_at), "MMM d, yyyy")}</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <SADAButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectAccount(acc)}
                          className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground"
                        >
                          {isAr ? "إدارة" : "Manage"}
                        </SADAButton>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SADAButton
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                              aria-label={isAr ? "الإجراءات" : "Actions"}
                            >
                              <MoreVertical className="size-4" />
                            </SADAButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 bg-card border border-border">
                            <DropdownMenuItem
                              onClick={() => onSelectAccount(acc)}
                              className="flex items-center gap-2 text-xs cursor-pointer"
                            >
                              <Sliders className="size-3.5" />
                              <span>{isAr ? "عرض مساحة العمل" : "View Workspace"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onOpenResetPassword(acc)}
                              className="flex items-center gap-2 text-xs cursor-pointer"
                            >
                              <Lock className="size-3.5" />
                              <span>{isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isSuspended ? (
                              <DropdownMenuItem
                                onClick={() => onOpenReactivate(acc)}
                                className="flex items-center gap-2 text-xs text-emerald-500 cursor-pointer"
                              >
                                <RotateCcw className="size-3.5" />
                                <span>{isAr ? "إعادة تفعيل الحساب" : "Reactivate Account"}</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => onOpenSuspend(acc)}
                                className="flex items-center gap-2 text-xs text-amber-500 cursor-pointer"
                              >
                                <AlertTriangle className="size-3.5" />
                                <span>{isAr ? "تعليق الوصول" : "Suspend Access"}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onOpenDelete(acc)}
                              className="flex items-center gap-2 text-xs text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                              <span>{isAr ? "حذف الحساب" : "Delete Account"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2.5">
        {accounts.map((acc) => {
          const roleBadge = getRoleBadgeStyle(acc.role);
          const isSelf = currentUserId === acc.user_id;
          const isSuspended = acc.status === "suspended";

          return (
            <div
              key={acc.user_id}
              onClick={() => onSelectAccount(acc)}
              className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 cursor-pointer hover:border-primary/40 transition-all text-start"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-muted border border-border overflow-hidden shrink-0 grid place-items-center font-display font-bold text-foreground text-xs uppercase shadow-sm">
                    {acc.photo_url ? (
                      <img src={acc.photo_url} alt={acc.display_name} className="size-full object-cover" />
                    ) : (
                      acc.display_name.slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-sm truncate flex items-center gap-1.5">
                      <span>{acc.display_name}</span>
                      {isSelf && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {isAr ? "أنت" : "You"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-mono" dir="ltr">{acc.email}</div>
                  </div>
                </div>

                {acc.status === "suspended" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {isAr ? "معلق" : "Suspended"}
                  </span>
                ) : acc.status === "pending" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {isAr ? "قيد الانتظار" : "Pending"}
                  </span>
                ) : acc.status === "disabled" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    {isAr ? "معطل" : "Disabled"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {isAr ? "نشط" : "Active"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-[11px]">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">{isAr ? "الدور" : "Role"}</span>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className={`inline-block font-medium ${roleBadge.badgeClass} px-2 py-0.5 rounded text-[10px]`}>
                      {getLocalizedRoleLabel(acc.role, roleBadge.label)}
                    </span>
                    {acc.module_permissions && Object.keys(acc.module_permissions).length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <Sliders className="size-2.5 text-primary" />
                        <span>{isAr ? "مخصص" : "Custom"}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">{isAr ? "القسم" : "Division"}</span>
                  <span className="font-medium text-foreground">{getLocalizedDivision(acc.division)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
                <span>{isAr ? "تاريخ الإنشاء: " : "Created "}<span dir="ltr">{acc.created_at ? format(parseISO(acc.created_at), "MMM d, yyyy") : "—"}</span></span>
                <span className="text-primary font-semibold cursor-pointer">{isAr ? "إدارة ←" : "Manage →"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
