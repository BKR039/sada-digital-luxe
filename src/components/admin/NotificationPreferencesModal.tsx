// ============================================================
// SADA OS — NOTIFICATION PREFERENCES 2.0
// Delivery Channels, Web Push Multi-Device Management,
// Required vs Optional Alerts, and Canonical SADA Design System.
// ============================================================

import React, { useState, useEffect } from "react";
import {
  SADADialog,
  SADASwitch,
  SADAButton,
  SADABadge,
} from "@/components/ui/sada-ui";
import { toast } from "sonner";
import {
  Bell,
  Sliders,
  Check,
  Loader2,
  Smartphone,
  Laptop,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Send,
  Radio,
  Mail,
} from "lucide-react";
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notification-service";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  registerPushDeviceSubscription,
  unregisterPushDeviceSubscription,
  fetchActiveUserSubscriptions,
  removeDeviceSubscription,
  sendTestPushNotification,
  type PushSubscriptionRecord,
} from "@/lib/browser-push-service";
import type { NotificationPreferences } from "@/types/notifications-and-audit";
import { useTranslation } from "@/i18n";

interface NotificationPreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

function parseDeviceLabel(ua?: string, type?: string): string {
  if (!ua) return type === "mobile" ? "Mobile Device" : "Desktop Browser";
  if (ua.includes("iPhone")) return "Apple iPhone (iOS Safari / PWA)";
  if (ua.includes("iPad")) return "Apple iPad (iPadOS PWA)";
  if (ua.includes("Android")) return "Android Phone (Chrome / PWA)";
  if (ua.includes("Macintosh")) return "Mac Workstation (Safari / Chrome)";
  if (ua.includes("Windows")) return "Windows Workstation (Chrome / Edge)";
  if (ua.includes("Linux")) return "Linux Workstation";
  return type === "mobile" ? "Mobile Device" : "Desktop Workstation";
}

export function NotificationPreferencesModal({
  open,
  onOpenChange,
  userId,
}: NotificationPreferencesModalProps) {
  const { t, isRTL } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  });

  // Browser permissions state
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);
  const [devices, setDevices] = useState<PushSubscriptionRecord[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    if (open) {
      setBrowserPerm(getBrowserNotificationPermission());
      if (userId) {
        setLoading(true);
        fetchNotificationPreferences(userId)
          .then((data) => setPrefs(data))
          .catch(() => toast.error(isRTL ? "تعذر تحميل التفضيلات" : "Failed to load preferences"))
          .finally(() => setLoading(false));

        setDevicesLoading(true);
        fetchActiveUserSubscriptions(userId)
          .then((list) => setDevices(list))
          .catch(() => {})
          .finally(() => setDevicesLoading(false));
      }
    }
  }, [open, userId, isRTL]);

  const handleToggle = (key: keyof Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleRequestBrowserPerm = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPerm(res);
    if (res === "granted") {
      setPrefs((prev) => ({ ...prev, desktop_push_enabled: true }));
      toast.success(isRTL ? "تم تفعيل إشعارات المتصفح بنجاح" : "Browser notifications enabled");
      // Refresh devices list
      if (userId) {
        fetchActiveUserSubscriptions(userId).then(setDevices).catch(() => {});
      }
    } else if (res === "denied") {
      toast.error(
        isRTL
          ? "تم حظر إشعارات المتصفح. يرجى تفعيلها من إعدادات المتصفح."
          : "Browser notifications were blocked. Please enable them in browser site settings."
      );
    }
  };

  const handleToggleMobilePush = async () => {
    const nextState = !prefs.mobile_push_enabled;
    setPushLoading(true);
    try {
      if (nextState) {
        const res = await registerPushDeviceSubscription(userId);
        if (res.success) {
          setPrefs((prev) => ({ ...prev, mobile_push_enabled: true }));
          toast.success(isRTL ? "تم تسجيل هذا الجهاز لإشعارات Push" : "Device registered for Web Push");
          fetchActiveUserSubscriptions(userId).then(setDevices).catch(() => {});
        } else {
          toast.error(res.error || (isRTL ? "فشل تسجيل الإشعارات" : "Failed to register Web Push"));
        }
      } else {
        await unregisterPushDeviceSubscription(userId);
        setPrefs((prev) => ({ ...prev, mobile_push_enabled: false }));
        toast.info(isRTL ? "تم تعطيل إشعارات Push لهذا الجهاز" : "Push disabled for this device");
        fetchActiveUserSubscriptions(userId).then(setDevices).catch(() => {});
      }
    } catch {
      toast.error(isRTL ? "حدث خطأ غير متوقع" : "An unexpected error occurred");
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await sendTestPushNotification(userId, isRTL ? "ar" : "en");
      if (res.success) {
        toast.success(
          isRTL
            ? "تم إرسال إشعار تجريبي! تحقق من جهازك أو شاشة القفل."
            : "Test notification dispatched! Check your notification tray or lock screen."
        );
      } else {
        toast.error(res.error || (isRTL ? "تعذر إرسال الإشعار التجريبي" : "Failed to send test push"));
      }
    } catch {
      toast.error(isRTL ? "حدث خطأ أثناء الإرسال" : "An error occurred while sending test");
    } finally {
      setTestingPush(false);
    }
  };

  const handleRemoveDevice = async (subId: string) => {
    try {
      const ok = await removeDeviceSubscription(subId);
      if (ok) {
        setDevices((prev) => prev.filter((d) => d.id !== subId));
        toast.success(isRTL ? "تمت إزالة الجهاز بنجاح" : "Device unregistered successfully");
      } else {
        toast.error(isRTL ? "تعذر إزالة الجهاز" : "Failed to unregister device");
      }
    } catch {
      toast.error(isRTL ? "حدث خطأ" : "Error removing device");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await saveNotificationPreferences(prefs);
      if (ok) {
        toast.success(isRTL ? "تم حفظ تفضيلات الإشعارات بنجاح" : "Notification preferences saved");
        onOpenChange(false);
      } else {
        toast.error(isRTL ? "تعذر حفظ التفضيلات" : "Failed to save preferences");
      }
    } catch {
      toast.error(isRTL ? "حدث خطأ غير متوقع" : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const SECTIONS = [
    {
      title: isRTL ? "المهام وسير العمل" : "Task & Workflow Alerts",
      description: isRTL ? "المواعيد النهائية، والتعيينات، وإشارات المراجعة" : "Deadlines, assignments, and handoffs",
      badge: "OPTIONAL",
      items: [
        {
          key: "task_assigned" as const,
          label: isRTL ? "تعيين مهمة جديدة" : "Task Assigned",
          desc: isRTL ? "تنبيه فوري عند إسناد مهمة جديدة إليك" : "Notify when a task is assigned to you",
        },
        {
          key: "task_due_soon" as const,
          label: isRTL ? "المهمة تقترب من موعدها" : "Task Due Soon",
          desc: isRTL ? "تنبيه استباقي قبل 24 ساعة من موعد التسليم" : "Notify 24 hours before a deadline",
        },
        {
          key: "task_overdue" as const,
          label: isRTL ? "المهمة متأخرة" : "Task Overdue",
          desc: isRTL ? "إنذار عالي الأولوية عند تجاوز الموعد المحدد" : "High priority alert when deadline passes",
        },
        {
          key: "client_approval_required" as const,
          label: isRTL ? "موافقة العميل مطلوبة" : "Client Approval Required",
          desc: isRTL ? "تنبيه عند جاهزية المخرج لمراجعة العميل" : "Alert when deliverable reaches client sign-off",
        },
      ],
    },
    {
      title: isRTL ? "الإنتاج والعمليات" : "Production & Delivery Alerts",
      description: isRTL ? "جداول التصوير وتتبع وتيرة التسليم" : "Shoot schedules and deliverable pace",
      badge: "OPTIONAL",
      items: [
        {
          key: "production_tomorrow" as const,
          label: isRTL ? "جلسة تصوير غداً" : "Production Shoot Tomorrow",
          desc: isRTL ? "تذكير بالجلسات المجدولة لليوم التالي" : "Reminders for scheduled shoots tomorrow",
        },
        {
          key: "deliverable_behind" as const,
          label: isRTL ? "تأخر في وتيرة الحزمة" : "Deliverable Behind Pace",
          desc: isRTL ? "تنبيه عند تأخر وتيرة تسليم الباقة الشهرية" : "Alert when package output falls behind timeline",
        },
        {
          key: "operations_enabled" as const,
          label: isRTL ? "تحديثات العمليات العامة" : "General Operations Updates",
          desc: isRTL ? "تحديثات المواعيد وتغيير حالات الإنتاج" : "Status changes and operational milestones",
        },
      ],
    },
    {
      title: isRTL ? "الرسائل والتنبيهات المباشرة" : "Direct Messages & Alerts",
      description: isRTL ? "تنبيهات المديرين والمحادثات الميدانية" : "Manager alerts and task-level discussions",
      badge: "OPTIONAL",
      items: [
        {
          key: "messages_enabled" as const,
          label: isRTL ? "رسائل وتنبيهات المهام" : "Direct Alerts & Messages",
          desc: isRTL ? "تنبيهات فورية عند وصول رسالة من مدير أو زميل" : "Instant notifications for manager alerts",
        },
      ],
    },
    {
      title: isRTL ? "المالية والتعويضات" : "Financial & Compensation Alerts",
      description: isRTL ? "الفواتير، والعمولات، وصرف المستحقات" : "Invoices, commissions, payments, and payroll",
      badge: "OPTIONAL",
      items: [
        {
          key: "invoice_overdue" as const,
          label: isRTL ? "فاتورة متأخرة" : "Invoice Overdue",
          desc: isRTL ? "تنبيه عند بقاء فواتير العملاء دون سداد" : "Alert when client invoices remain unpaid",
        },
        {
          key: "payment_received" as const,
          label: isRTL ? "استلام دفعة مالية" : "Payment Received",
          desc: isRTL ? "إشعار عند تسجيل سداد فاتورة جديدة" : "Notify when a client invoice is settled",
        },
        {
          key: "commission_eligible" as const,
          label: isRTL ? "استحقاق عمولة" : "Commission Eligible",
          desc: isRTL ? "إشعار عند فوز صفقة تجارية تستحق عمولة" : "Notify when a closed deal earns commission",
        },
        {
          key: "salary_paid" as const,
          label: isRTL ? "صرف الرواتب والسلف" : "Salary & Advance Disbursed",
          desc: isRTL ? "تأكيد تنفيذ الرواتب أو إيداع السلف" : "Confirm payroll execution or advance deposits",
        },
        {
          key: "month_end_closing" as const,
          label: isRTL ? "إقفال الشهر المالي" : "Month-End Closing Due",
          desc: isRTL ? "تذكير الإدارة بإقفال الفترة المالية" : "Remind executive team to close financial period",
        },
      ],
    },
  ];

  return (
    <SADADialog
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      icon={<Sliders className="size-4 text-primary" />}
      title={isRTL ? "تفضيلات الإشعارات والتنبيهات" : "Notification & Alert Preferences"}
      description={
        isRTL
          ? "تحكم في قنوات التسليم وأنواع التنبيهات المباشرة لنظام SADA OS"
          : "Control delivery channels and event alerts across your SADA OS workspaces"
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-muted-foreground font-mono">
            {isRTL ? "يتم حفظ التفضيلات فورياً" : "Preferences sync across your active devices"}
          </div>
          <div className="flex items-center gap-2">
            <SADAButton
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {isRTL ? "إلغاء" : "Cancel"}
            </SADAButton>
            <SADAButton
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={saving}
              leftIcon={<Check className="size-3.5" />}
            >
              {isRTL ? "حفظ التغييرات" : "Save Changes"}
            </SADAButton>
          </div>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-xs font-mono flex flex-col items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            {isRTL ? "جاري تحميل التفضيلات..." : "Loading preferences..."}
          </div>
        ) : (
          <>
            {/* DELIVERY CHANNELS CARD */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold font-heading text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop className="size-3.5 text-primary" />
                    {isRTL ? "قنوات التسليم الفوري" : "Instant Delivery Channels"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRTL
                      ? "إشعارات المتصفح لسطح المكتب وتنبيهات Web Push للأجهزة المحمولة"
                      : "Native Desktop Notifications & Mobile Web Push Delivery"}
                  </p>
                </div>
                <SADABadge variant="primary" size="xs">
                  {isRTL ? "القنوات النشطة" : "Active Channels"}
                </SADABadge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Channel 1: Desktop Browser Notifications */}
                <div className="p-3 rounded-xl bg-card border border-border/60 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {isRTL ? "إشعارات المتصفح (Desktop)" : "Desktop Notifications"}
                      </span>
                      {browserPerm === "granted" ? (
                        <SADABadge variant="success" size="xs">
                          {isRTL ? "مسموح" : "Granted"}
                        </SADABadge>
                      ) : browserPerm === "denied" ? (
                        <SADABadge variant="danger" size="xs">
                          {isRTL ? "محظور" : "Blocked"}
                        </SADABadge>
                      ) : (
                        <SADABadge variant="neutral" size="xs">
                          {isRTL ? "غير مفعل" : "Default"}
                        </SADABadge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isRTL
                        ? "تنبيهات فورية لسطح المكتب حتى عند تصغير المتصفح"
                        : "Native OS banners even when browser is minimized"}
                    </p>
                    {browserPerm !== "granted" && (
                      <button
                        type="button"
                        onClick={handleRequestBrowserPerm}
                        className="mt-2 text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isRTL ? "طلب الإذن الآن" : "Grant Browser Permission"}</span>
                        <ExternalLink className="size-2.5" />
                      </button>
                    )}
                  </div>
                  <SADASwitch
                    checked={Boolean(prefs.desktop_push_enabled && browserPerm === "granted")}
                    onCheckedChange={(checked) => {
                      if (checked && browserPerm !== "granted") {
                        handleRequestBrowserPerm();
                      } else {
                        handleToggle("desktop_push_enabled");
                      }
                    }}
                    size="sm"
                    aria-label="Toggle Desktop Notifications"
                  />
                </div>

                {/* Channel 2: Mobile Web Push (PWA) */}
                <div className="p-3 rounded-xl bg-card border border-border/60 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Smartphone className="size-3 text-primary" />
                        {isRTL ? "إشعارات الجوال (Web Push)" : "Mobile Push (PWA)"}
                      </span>
                      {prefs.mobile_push_enabled ? (
                        <SADABadge variant="success" size="xs">
                          {isRTL ? "نشط" : "Active"}
                        </SADABadge>
                      ) : (
                        <SADABadge variant="neutral" size="xs">
                          {isRTL ? "معطل" : "Off"}
                        </SADABadge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isRTL
                        ? "تنبيهات نظام التشغيل للهواتف وتطبيق PWA الميداني"
                        : "Device notifications via SADA OS Service Worker"}
                    </p>
                  </div>
                  <SADASwitch
                    checked={Boolean(prefs.mobile_push_enabled)}
                    onCheckedChange={handleToggleMobilePush}
                    disabled={pushLoading}
                    size="sm"
                    aria-label="Toggle Mobile Push"
                  />
                </div>

                {/* Channel 3: Transactional Email (Resend) */}
                <div className="p-3 rounded-xl bg-card border border-border/60 flex items-start justify-between gap-3 sm:col-span-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        <Mail className="size-3 text-primary" />
                        {isRTL ? "إشعارات البريد الإلكتروني (Resend)" : "Transactional Email (Resend)"}
                      </span>
                      {prefs.email_notifications_enabled !== false ? (
                        <SADABadge variant="success" size="xs">
                          {isRTL ? "مفعل" : "Active"}
                        </SADABadge>
                      ) : (
                        <SADABadge variant="neutral" size="xs">
                          {isRTL ? "معطل" : "Disabled"}
                        </SADABadge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {isRTL
                        ? "رسائل بريد إلكتروني فاخرة لمهامك وتنبيهات المواعيد والمراجعات من SADA"
                        : "Receive luxury transactional emails for task assignments, deadline alerts, and review updates"}
                    </p>
                  </div>
                  <SADASwitch
                    checked={prefs.email_notifications_enabled !== false}
                    onCheckedChange={() => handleToggle("email_notifications_enabled")}
                    size="sm"
                    aria-label="Toggle Email Notifications"
                  />
                </div>
              </div>
            </div>

            {/* REGISTERED PUSH DEVICES & TEST DELIVERY */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold font-heading text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="size-3.5 text-primary" />
                    {isRTL ? "الأجهزة المسجلة لإشعارات Push" : "Registered Push Devices"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRTL
                      ? "إدارة الأجهزة المتصلة بخدمة Web Push RFC 8292 واختبار التسليم"
                      : "Manage active devices receiving OS notifications and test delivery"}
                  </p>
                </div>
                <SADAButton
                  variant="outline"
                  size="xs"
                  onClick={handleSendTestPush}
                  isLoading={testingPush}
                  leftIcon={<Send className="size-3" />}
                >
                  {isRTL ? "إرسال إشعار تجريبي" : "Send Test Notification"}
                </SADAButton>
              </div>

              {devicesLoading ? (
                <div className="p-4 text-center text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  {isRTL ? "جاري تحميل الأجهزة..." : "Loading registered devices..."}
                </div>
              ) : devices.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-card/60 border border-dashed border-border/70 text-center">
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL
                      ? "لا توجد أجهزة مسجلة حالياً. قم بتفعيل إشعارات الجوال أو إذن المتصفح أعلاه لتسجيل هذا الجهاز."
                      : "No active devices registered yet. Enable Mobile Push or grant browser permissions above to register this device."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-2.5 rounded-xl bg-card border border-border/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0">
                          {dev.device_type === "mobile" || dev.device_type === "tablet" ? (
                            <Smartphone className="size-3.5" />
                          ) : (
                            <Laptop className="size-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {parseDeviceLabel(dev.user_agent, dev.device_type)}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {isRTL ? "مسجل: " : "Registered: "}
                            {dev.created_at ? new Date(dev.created_at).toLocaleDateString() : "Active"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SADABadge variant="success" size="xs">
                          {isRTL ? "نشط" : "Online"}
                        </SADABadge>
                        <button
                          type="button"
                          onClick={() => dev.id && handleRemoveDevice(dev.id)}
                          disabled={!dev.id}
                          className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid place-items-center transition-colors cursor-pointer"
                          title={isRTL ? "إلغاء تسجيل هذا الجهاز" : "Unregister this device"}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MANDATORY / REQUIRED SECURITY TIER */}
            <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-purple-500/15 border border-purple-500/30 grid place-items-center text-purple-400 shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-foreground">
                      {isRTL ? "تنبيهات الأمان وحساب النظام" : "Security & Account Alerts"}
                    </h5>
                    <SADABadge variant="purple" size="xs">
                      {isRTL ? "إلزامي • لا يمكن التعطيل" : "REQUIRED • SYSTEM MANDATORY"}
                    </SADABadge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRTL
                      ? "تسجيلات الدخول غير المعتادة، تعديلات الصلاحيات، وحالات تعليق الحساب يتم تسليمها إجبارياً لحماية النظام."
                      : "Unusual logins, role reassignments, and account suspensions are strictly delivered for audit integrity."}
                  </p>
                </div>
              </div>
              <SADASwitch
                checked={true}
                disabled={true}
                size="sm"
                aria-label="Security alerts (mandatory)"
              />
            </div>

            {/* OPTIONAL EVENT CATEGORIES */}
            <div className="space-y-5">
              {SECTIONS.map((sec) => (
                <div key={sec.title} className="p-3.5 rounded-2xl bg-card border border-border/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground font-heading uppercase tracking-wider">
                        {sec.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{sec.description}</p>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/70 uppercase">
                      {sec.badge}
                    </span>
                  </div>

                  <div className="divide-y divide-border/40">
                    {sec.items.map((item) => (
                      <div
                        key={item.key}
                        className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 pe-2">
                          <div className="text-xs font-medium text-foreground">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.desc}
                          </div>
                        </div>
                        <SADASwitch
                          checked={Boolean((prefs as any)[item.key])}
                          onCheckedChange={() => handleToggle(item.key as any)}
                          size="sm"
                          aria-label={item.label}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </SADADialog>
  );
}
