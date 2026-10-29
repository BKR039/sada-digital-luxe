// SADA OS — balanced, touch-friendly mobile navigation.

import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckCircle2,
  CalendarDays,
  Landmark,
  Menu,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface SADAMobileBottomNavProps {
  onOpenSidebar: () => void;
  onOpenNextTask?: () => void;
}

export function SADAMobileBottomNav({ onOpenSidebar }: SADAMobileBottomNavProps) {
  const { t, isRTL } = useTranslation();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isOverview = currentPath === "/admin" || currentPath === "/admin/";
  const isMyWork = currentPath.startsWith("/admin/my-work");
  const isCalendar = currentPath.startsWith("/admin/calendar");
  const isFinance = currentPath.startsWith("/admin/finance") || currentPath.startsWith("/admin/my-salary");

  const items = [
    { to: "/admin", label: t("admin.overview") || "Overview", Icon: LayoutDashboard, active: isOverview },
    { to: "/admin/my-work", label: t("admin.myWork") || "My Work", Icon: CheckCircle2, active: isMyWork },
    { to: "/admin/calendar", label: t("admin.calendar") || "Calendar", Icon: CalendarDays, active: isCalendar },
    { to: "/admin/finance", label: isRTL ? "المالية" : "Finance", ariaLabel: t("admin.finance") || "Finance", Icon: Landmark, active: isFinance },
  ];

  const itemClass = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.1rem] px-0.5 py-1.5 text-center transition-colors duration-150 touch-manipulation active:scale-[0.97] ${
      active
        ? "bg-primary/10 text-primary dark:bg-cyan-400/15 dark:text-cyan-300"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    }`;

  return (
    <nav
      id="sada-mobile-bottom-nav"
      aria-label={isRTL ? "التنقل الرئيسي" : "Main navigation"}
      className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.65rem)] z-40 mx-auto max-w-[26rem]"
    >
      <div className="flex items-stretch gap-1 rounded-[1.55rem] border border-border/80 bg-card/95 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/92 dark:shadow-[0_12px_38px_rgba(0,0,0,0.48)]">
        {items.map(({ to, label, ariaLabel, Icon, active }) => (
          <Link
            key={to}
            to={to}
            className={itemClass(active)}
            aria-label={ariaLabel || label}
            aria-current={active ? "page" : undefined}
          >
            <span className="grid size-6 shrink-0 place-items-center" aria-hidden="true">
              <Icon className="size-[21px]" strokeWidth={active ? 2.35 : 2.1} />
            </span>
            <span className="block max-w-full truncate text-[10px] font-medium leading-tight tracking-[-0.01em]">
              {label}
            </span>
          </Link>
        ))}
        <button
          type="button"
          onClick={onOpenSidebar}
          className={itemClass(false)}
          aria-label={isRTL ? "فتح قائمة التنقل" : "Open navigation menu"}
        >
          <span className="grid size-6 shrink-0 place-items-center" aria-hidden="true">
            <Menu className="size-[21px]" strokeWidth={2.1} />
          </span>
          <span className="block max-w-full truncate text-[10px] font-medium leading-tight tracking-[-0.01em]">
            {isRTL ? "المزيد" : "More"}
          </span>
        </button>
      </div>
    </nav>
  );
}
