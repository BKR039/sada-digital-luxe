export const operationsModule = {
  en: {
    calendarView: {
      title: "Agency Operations Calendar",
      subtitle: "Unified schedule for content shootings, client deadlines, milestone reviews, and team availability.",
      today: "Today",
      month: "Month",
      week: "Week",
      day: "Day",
      filters: {
        all: "All Events",
        tasks: "Tasks & Deadlines",
        shoots: "Photo & Video Shoots",
        meetings: "Client Meetings",
        milestones: "Project Milestones",
      },
      newEvent: "Schedule Event",
      eventDetails: "Event Details",
      noEventsToday: "No scheduled events for this day.",
    },
    team: {
      title: "Team Workload & Capacity",
      subtitle: "Real-time specialist capacity, active task distribution, availability, and burnout prevention.",
      kpis: {
        activeMembers: "Active Specialists",
        avgUtilization: "Average Workload Utilization",
        overloadedMembers: "Near / Over Capacity",
        availableCapacity: "Available Bandwidth",
      },
      memberCard: {
        utilization: "{percent}% utilized",
        activeTasks: "{count} active tasks",
        available: "Available for new work",
        optimal: "Optimal load",
        overloaded: "Capacity warning",
        viewWorkspace: "View Member Workspace",
      },
      skills: "Specializations",
      role: "Team Role",
    },
    businessRules: {
      title: "Automated Agency Business Rules",
      subtitle: "Configure automated SLA monitors, margin protection thresholds, and executive escalation triggers.",
      rules: {
        maxAdvancePercent: "Maximum Salary Advance Allowance (%)",
        overdueNotificationDays: "Overdue Task Escalation Threshold (Days)",
        invoiceGracePeriodDays: "Invoice Payment Grace Period (Days)",
        minimumGrossMarginPercent: "Minimum Target Gross Margin (%)",
        highPriorityThreshold: "High Priority Task Warning Window (Hours)",
      },
      enforcement: "Automated Rule Enforcement",
      activeRulesCount: "{count} active automated policies",
    },
    notifications: {
      title: "Notification Center",
      markAllRead: "Mark all as read",
      preferences: "Notification Preferences",
      allCaughtUp: "All caught up!",
      emptyDescription: "Zero pending alerts. Your operational queue is completely up to date.",
      priorities: {
        urgent: "Urgent",
        high: "High Priority",
        normal: "Normal",
        low: "Low",
      },
      categories: {
        all: "All Alerts",
        task: "Tasks & Milestones",
        production: "Operations & Shoots",
        billing: "Invoices & Billing",
        finance: "Finance & Accounts",
        security: "Security & Audits",
        messages: "Direct Messages",
        system: "System & Platform",
      },
      events: {
        task_deadline: {
          title: "Deadline Approaching",
          message: "Task '{taskName}' is approaching its deadline and is in progress.",
        },
        task_alert: {
          title: "Message from {senderName}",
          message: "{message}",
        },
        manager_message: {
          title: "Message from {senderName}",
          message: "{message}",
        },
        task_assigned: {
          title: "New Task Assigned",
          message: "You have been assigned to: {taskName}",
        },
        task_reassigned: {
          title: "Task Reassigned",
          message: "You were assigned to: {taskName}",
        },
        task_due_soon: {
          title: "Task Due Soon",
          message: "Task '{taskName}' is due within 24 hours.",
        },
        task_overdue: {
          title: "Task Overdue",
          message: "Task '{taskName}' has passed its deadline.",
        },
        task_blocked: {
          title: "Task Blocked",
          message: "Task '{taskName}' has been flagged as blocked.",
        },
        task_unblocked: {
          title: "Task Unblocked",
          message: "Blocker resolved for '{taskName}'. Execution resumed.",
        },
        task_review_requested: {
          title: "Review Requested",
          message: "Deliverable '{taskName}' submitted for review.",
        },
        task_revision_requested: {
          title: "Revision Requested",
          message: "Changes requested for deliverable '{taskName}'.",
        },
        task_approved: {
          title: "Task Approved",
          message: "Deliverable '{taskName}' approved and completed.",
        },
        task_publishing_handoff: {
          title: "Ready for Publishing",
          message: "Content for '{taskName}' is edited and ready for live distribution.",
        },
        task_published: {
          title: "Task Published",
          message: "Content for '{taskName}' is now live on social platforms.",
        },
        client_approval_required: {
          title: "Approval Required",
          message: "Deliverable for '{clientName}' is awaiting your review.",
        },
        invoice_overdue: {
          title: "Invoice Overdue",
          message: "Invoice #{invoiceNumber} for '{clientName}' is past due.",
        },
        payment_received: {
          title: "Payment Received",
          message: "Received payment of {amount} from '{clientName}'.",
        },
        commission_eligible: {
          title: "Commission Eligible",
          message: "A new deal has qualified for sales commission payout.",
        },
        commission_approved: {
          title: "Commission Approved",
          message: "Sales commission has been reviewed and approved.",
        },
        salary_paid: {
          title: "Salary Disbursed",
          message: "Your compensation for this period has been processed.",
        },
        salary_request_pending: {
          title: "Advance Request Pending",
          message: "{employeeName} has requested a salary advance of {amount}.",
        },
        production_tomorrow: {
          title: "Production Shoot Tomorrow",
          message: "Shooting session scheduled tomorrow for {clientName}.",
        },
        deliverable_behind: {
          title: "Deliverable Behind Schedule",
          message: "Deliverable pace is behind schedule for {clientName}.",
        },
        month_end_closing: {
          title: "Month-End Closing Due",
          message: "Financial period closing and ledger audit is due.",
        },
        security_audit: {
          title: "Security Audit Alert",
          message: "A privileged action or security modification occurred.",
        },
        general: {
          title: "System Notification",
          message: "Operational system notification.",
        },
      },
    },
    analytics: {
      title: "Analytics & Executive KPIs",
      subtitle: "High-level performance telemetry, delivery velocity, client health, and profitability metrics.",
      metrics: {
        onTimeDeliveryRate: "On-Time Delivery Rate",
        clientRetentionRate: "Client Retention Rate",
        avgTaskCompletionHours: "Average Task Completion Time",
        monthlyRevenueGrowth: "Revenue Growth (MoM)",
        blendedGrossMargin: "Blended Gross Margin",
      },
      charts: {
        revenueVsExpenses: "Revenue vs Operating Expenses",
        taskVelocity: "Completed Tasks Velocity",
        clientProfitability: "Profitability by Client",
        workloadDistribution: "Workload by Division",
      },
      timeRange: {
        last30Days: "Last 30 Days",
        lastQuarter: "Last Quarter",
        yearToDate: "Year to Date",
        allTime: "All Time",
      },
    },
  },
  ar: {
    calendarView: {
      title: "تقويم العمليات والإنتاج",
      subtitle: "الجدول الموحد لجلسات التصوير، مواعيد التسليم للعملاء، مراجعة المراحل، وجاهزية الفريق.",
      today: "اليوم",
      month: "شهر",
      week: "أسبوع",
      day: "يوم",
      filters: {
        all: "جميع الأحداث",
        tasks: "المهام والمواعيد النهائية",
        shoots: "جلسات التصوير والإنتاج",
        meetings: "اجتماعات العملاء",
        milestones: "المراحل الرئيسية",
      },
      newEvent: "جدولة حدث",
      eventDetails: "تفاصيل الحدث",
      noEventsToday: "لا توجد أحداث مجدولة لهذا اليوم.",
    },
    team: {
      title: "أعباء الفريق والطاقة الاستيعابية",
      subtitle: "متابعة فورية لطاقة المختصين، توزيع المهام النشطة، الجاهزية، وتفادي ضغط العمل الزائد.",
      kpis: {
        activeMembers: "المختصون النشطون",
        avgUtilization: "متوسط إشغال الفريق",
        overloadedMembers: "على وشك بلوغ الحد الأقصى",
        availableCapacity: "الطاقة المتاحة للعمل",
      },
      memberCard: {
        utilization: "نسبة الإشغال: {percent}%",
        activeTasks: "{count} مهام نشطة",
        available: "متاح لمهام جديدة",
        optimal: "حجم عمل مثالي",
        overloaded: "تنبيه: عبء زائد",
        viewWorkspace: "فتح مساحة عمل المختص",
      },
      skills: "المجالات والتخصصات",
      role: "الدور في الفريق",
    },
    businessRules: {
      title: "قواعد العمل التلقائية للوكالة",
      subtitle: "ضبط ومراقبة مؤشرات اتفاقية مستوى الخدمة (SLA)، حماية هوامش الربح، والتنبيهات التصعيدية.",
      rules: {
        maxAdvancePercent: "سقف التسبيق المسموح من الراتب (%)",
        overdueNotificationDays: "مهلة تصعيد المهام المتأخرة (أيام)",
        invoiceGracePeriodDays: "مهلة سداد الفواتير قبل الإشعار (أيام)",
        minimumGrossMarginPercent: "الحد الأدنى لهامش الربح الإجمالي (%)",
        highPriorityThreshold: "نافذة التحذير للمهام العاجلة (ساعات)",
      },
      enforcement: "التطبيق الآلي للقواعد",
      activeRulesCount: "{count} سياسات عمل تلقائية مفعلة",
    },
    notifications: {
      title: "مركز الإشعارات",
      markAllRead: "تحديد الكل كمقروء",
      preferences: "تفضيلات الإشعارات",
      allCaughtUp: "كل شيء مكتمل!",
      emptyDescription: "لا توجد تنبيهات معلقة. جدولك التشغيلي محدث بالكامل.",
      priorities: {
        urgent: "عاجل",
        high: "أولوية عالية",
        normal: "عادي",
        low: "منخفض",
      },
      categories: {
        all: "جميع التنبيهات",
        task: "المهام والتسليمات",
        production: "العمليات والتصوير",
        billing: "الفواتير والمستحقات",
        finance: "المالية والحسابات",
        security: "الأمان والتدقيق",
        messages: "الرسائل المباشرة",
        system: "النظام والمنصة",
      },
      events: {
        task_deadline: {
          title: "اقتراب موعد التسليم",
          message: "المهمة '{taskName}' شارفت على موعد التسليم ولا تزال قيد التنفيذ.",
        },
        task_alert: {
          title: "رسالة من {senderName}",
          message: "{message}",
        },
        manager_message: {
          title: "رسالة من {senderName}",
          message: "{message}",
        },
        task_assigned: {
          title: "تم تعيين مهمة جديدة لك",
          message: "تم تعيينك للمهمة: {taskName}",
        },
        task_reassigned: {
          title: "إعادة تعيين مهمة",
          message: "تمت إعادة تعيين المهمة إليك: {taskName}",
        },
        task_due_soon: {
          title: "اقتراب موعد استحقاق مهمة",
          message: "المهمة '{taskName}' تنتهي خلال 24 ساعة.",
        },
        task_overdue: {
          title: "مهمة متأخرة عن الموعد",
          message: "المهمة '{taskName}' تجاوزت الموعد النهائي المحدد.",
        },
        task_blocked: {
          title: "المهمة معطلة",
          message: "تم تسجيل المهمة '{taskName}' كمعطلة وبانتظار حل التعطل.",
        },
        task_unblocked: {
          title: "رفع تعطل المهمة",
          message: "تم حل التعطل للمهمة '{taskName}' واستئناف التنفيذ.",
        },
        task_review_requested: {
          title: "طلب مراجعة التسليم",
          message: "تم إرسال المهمة '{taskName}' للمراجعة والاعتماد.",
        },
        task_revision_requested: {
          title: "طلب تعديلات على المهمة",
          message: "تم طلب تعديلات إضافية على تسليم المهمة '{taskName}'.",
        },
        task_approved: {
          title: "تم اعتماد التسليم",
          message: "تم اعتماد وإنجاز تسليم المهمة '{taskName}'.",
        },
        task_publishing_handoff: {
          title: "جاهز للنشر والتوزيع",
          message: "تم إنهاء مونتاج '{taskName}' وأصبح جاهزاً للنشر والتوزيع.",
        },
        task_published: {
          title: "تم النشر بنجاح",
          message: "تم نشر المهمة '{taskName}' على المنصات بنجاح.",
        },
        client_approval_required: {
          title: "مطلوب اعتماد التسليم",
          message: "المخرج الخاص بالعميل '{clientName}' بانتظار مراجعتك.",
        },
        invoice_overdue: {
          title: "فاتورة متأخرة السداد",
          message: "الفاتورة رقم #{invoiceNumber} للعميل '{clientName}' تجاوزت موعد الاستحقاق.",
        },
        payment_received: {
          title: "تم استلام دفعة مالية",
          message: "تم تسجيل استلام مبلغ {amount} من العميل '{clientName}'.",
        },
        commission_eligible: {
          title: "استحقاق عمولة مبيعات",
          message: "تأهلت صفقة جديدة لصرف عمولة المبيعات.",
        },
        commission_approved: {
          title: "تمت الموافقة على العمولة",
          message: "تمت مراجعة واعتماد عمولة المبيعات بنجاح.",
        },
        salary_paid: {
          title: "تم صرف الراتب",
          message: "تمت معالجة وصرف مستحقاتك المالية لهذه الفترة.",
        },
        salary_request_pending: {
          title: "طلب تسبيق معلق",
          message: "قدم {employeeName} طلباً لتسبيق راتب بمبلغ {amount}.",
        },
        production_tomorrow: {
          title: "جلسة تصوير غداً",
          message: "جلسة تصوير مجدولة غداً لصالح العميل {clientName}.",
        },
        deliverable_behind: {
          title: "تسليم متأخر عن الوتيرة",
          message: "وتيرة إنجاز التسليمات متأخرة عن الجدول لصالح {clientName}.",
        },
        month_end_closing: {
          title: "إقفال نهاية الشهر المالي",
          message: "حان موعد إقفال الدفاتر المحاسبية ومراجعة القيود الشهرية.",
        },
        security_audit: {
          title: "تنبيه أمان وتدقيق",
          message: "تم تسجيل إجراء حساس أو تعديل أمني في النظام.",
        },
        general: {
          title: "إشعار نظام",
          message: "إشعار تشغيلي من المنظومة.",
        },
      },
    },
    analytics: {
      title: "التحليلات والمؤشرات التنفيذية",
      subtitle: "مؤشرات الأداء التشغيلي المتقدم، سرعة التنفيذ والتسليم، استقرار العملاء، والربحية.",
      metrics: {
        onTimeDeliveryRate: "نسبة التسليم في الموعد",
        clientRetentionRate: "نسبة الاحتفاظ بالعملاء",
        avgTaskCompletionHours: "متوسط وقت إنجاز المهمة",
        monthlyRevenueGrowth: "نمو الإيرادات الشهري",
        blendedGrossMargin: "متوسط هامش الربح الإجمالي",
      },
      charts: {
        revenueVsExpenses: "مقارنة الإيرادات بالمصاريف التشغيلية",
        taskVelocity: "سرعة إنجاز المهام",
        clientProfitability: "الربحية حسب العميل",
        workloadDistribution: "توزيع العمل حسب الأقسام",
      },
      timeRange: {
        last30Days: "آخر 30 يوماً",
        lastQuarter: "الربع الأخير",
        yearToDate: "منذ بداية العام",
        allTime: "كامل الفترة",
      },
    },
  },
};
