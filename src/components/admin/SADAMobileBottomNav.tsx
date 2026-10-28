// ============================================================
// SADA OS — MOBILE BOTTOM NAVIGATION BAR (PWA / APP-LIKE GLASS DOCK)
// Ultra-Premium Glassmorphism, Zero-Latency Touch, Balanced 5-Item Architecture
// ============================================================

import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckCircle2,
  CalendarDays,
  Landmark,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "@/i18n";

interface SADAMobileBottomNavProps {
  onOpenSidebar: () => void;
  onOpenNextTask?: () => void;
}

export function SADAMobileBottomNav({
  onOpenSidebar,
}: SADAMobileBottomNavProps) {
  const { t, isRTL } = useTranslation();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isOverview = currentPath === "/admin" || currentPath === "/admin/";
  const isMyWork = currentPath.startsWith("/admin/my-work");
  const isCalendar = currentPath.startsWith("/admin/calendar");
  const isFinance = currentPath.startsWith("/admin/finance") || currentPath.startsWith("/admin/my-salary");

  return (
    <nav
      id="sada-mobile-bottom-nav"
      aria-label="Mobile Navigation Dock"
      className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40"
    >
      <div className="relative rounded-2xl bg-card/80 dark:bg-zinc-950/85 backdrop-blur-2xl border border-border/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_42px_rgba(0,0,0,0.7)] p-1.5 flex items-center justify-between gap-1 ring-1 ring-black/5 dark:ring-white/5">
        {/* 1. Overview */}
        <Link
          to="/admin"
          className={`flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl text-center transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer ${
            isOverview
              ? "bg-primary/10 dark:bg-cyan-500/15 text-primary dark:text-cyan-400 font-bold shadow-xs"
              : "text-muted-foreground/75 hover:text-foreground"
          }`}
          aria-label={t("admin.overview") || "Overview"}
          aria-current={isOverview ? "page" : undefined}
        >
          <LayoutDashboard className={`size-4.5 transition-transform ${isOverview ? "scale-105 stroke-[2.2px]" : "stroke-[1.75px]"}`} />
          <span className="text-[10px] mt-0.5 truncate tracking-tight">
            {t("admin.overview") || "Overview"}
          </span>
          {isOverview && (
            <span className="size-1 rounded-full bg-primary dark:bg-cyan-400 mt-0.5 shadow-sm" />
          )}
        </Link>

        {/* 2. My Work */}
        <Link
          to="/admin/my-work"
          className={`flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl text-center transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer ${
            isMyWork
              ? "bg-primary/10 dark:bg-cyan-500/15 text-primary dark:text-cyan-400 font-bold shadow-xs"
              : "text-muted-foreground/75 hover:text-foreground"
          }`}
          aria-label={t("admin.myWork") || "My Work"}
          aria-current={isMyWork ? "page" : undefined}
        >
          <CheckCircle2 className={`size-4.5 transition-transform ${isMyWork ? "scale-105 stroke-[2.2px]" : "stroke-[1.75px]"}`} />
          <span className="text-[10px] mt-0.5 truncate tracking-tight">
            {t("admin.myWork") || "My Work"}
          </span>
          {isMyWork && (
            <span className="size-1 rounded-full bg-primary dark:bg-cyan-400 mt-0.5 shadow-sm" />
          )}
        </Link>

        {/* 3. Calendar */}
        <Link
          to="/admin/calendar"
          className={`flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl text-center transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer ${
            isCalendar
              ? "bg-primary/10 dark:bg-cyan-500/15 text-primary dark:text-cyan-400 font-bold shadow-xs"
              : "text-muted-foreground/75 hover:text-foreground"
          }`}
          aria-label={t("admin.calendar") || "Calendar"}
          aria-current={isCalendar ? "page" : undefined}
        >
          <CalendarDays className={`size-4.5 transition-transform ${isCalendar ? "scale-105 stroke-[2.2px]" : "stroke-[1.75px]"}`} />
          <span className="text-[10px] mt-0.5 truncate tracking-tight">
            {t("admin.calendar") || "Calendar"}
          </span>
          {isCalendar && (
            <span className="size-1 rounded-full bg-primary dark:bg-cyan-400 mt-0.5 shadow-sm" />
          )}
        </Link>

        {/* 4. Finance / Treasury */}
        <Link
          to="/admin/finance"
          className={`flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl text-center transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer ${
            isFinance
              ? "bg-primary/10 dark:bg-cyan-500/15 text-primary dark:text-cyan-400 font-bold shadow-xs"
              : "text-muted-foreground/75 hover:text-foreground"
          }`}
          aria-label={t("admin.finance") || "Finance"}
          aria-current={isFinance ? "page" : undefined}
        >
          <Landmark className={`size-4.5 transition-transform ${isFinance ? "scale-105 stroke-[2.2px]" : "stroke-[1.75px]"}`} />
          <span className="text-[10px] mt-0.5 truncate tracking-tight">
            {t("admin.finance") || "Finance"}
          </span>
          {isFinance && (
            <span className="size-1 rounded-full bg-primary dark:bg-cyan-400 mt-0.5 shadow-sm" />
          )}
        </Link>

        {/* 5. Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex-1 flex flex-col items-center justify-center min-h-[46px] py-1 px-1 rounded-xl text-center text-muted-foreground/75 hover:text-foreground transition-all duration-150 active:scale-90 touch-manipulation cursor-pointer"
          aria-label="Open Full Navigation Menu"
        >
          <SlidersHorizontal className="size-4.5 stroke-[1.75px]" />
          <span className="text-[10px] mt-0.5 truncate tracking-tight">
            {isRTL ? "المزيد" : "More"}
          </span>
        </button>
      </div>
    </nav>
  );
}
