/**
 * SADA OS Universal Design System — Canonical Component Exports
 * Every page, modal, workflow, and dashboard MUST consume these components.
 * Native browser selects, unstyled inputs, native checkboxes, native number spinners,
 * and ad-hoc controls are strictly barred.
 */

import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Progress } from "./progress";

export * from "./sada-controls";

// Buttons & Inputs
export {
  SADAButton,
  SADAButton as SadaButton,
  sadaButtonVariants,
  type SADAButtonProps,
} from "./sada-button";
export {
  SADAInput,
  SADAInput as SadaInput,
  SADATextarea,
  SADATextarea as SadaTextarea,
  type SADAInputProps,
  type SADATextareaProps,
} from "./sada-input";

// Dropdowns & Pickers
export {
  SADASelect,
  SADASelect as SadaSelect,
  type SADASelectOption,
  type SADASelectProps,
} from "./sada-select";
export {
  SADAMultiSelect,
  SADAMultiSelect as SadaMultiSelect,
  type SADAMultiSelectOption,
  type SADAMultiSelectProps,
} from "./sada-multi-select";
export {
  SADACombobox,
  SADACombobox as SadaCombobox,
  type SADAComboboxOption,
  type SADAComboboxProps,
} from "./sada-combobox";
export {
  SADADatePicker,
  SADADatePicker as SadaDatePicker,
  type SADADatePickerProps,
} from "./sada-date-picker";
export {
  SADADateDateTimePicker,
  SADADateDateTimePicker as SadaDateDateTimePicker,
  SADADateTimePicker,
  SADADateTimePicker as SadaDateTimePicker,
  type SADADateDateTimePickerProps,
  type SADADateTimePickerProps,
} from "./sada-date-time-picker";
export {
  SADATimePicker,
  SADATimePicker as SadaTimePicker,
  type SADATimePickerProps,
} from "./sada-time-picker";

// Interactive Form Controls (NO NATIVE HTML CONTROLS)
export {
  SADACheckbox,
  SADACheckbox as SadaCheckbox,
  type SADACheckboxProps,
} from "./sada-checkbox";
export {
  SADASwitch,
  SADASwitch as SadaSwitch,
  type SADASwitchProps,
} from "./sada-switch";
export {
  SADACounter,
  SADACounter as SadaCounter,
  SADANumberStepper,
  SADANumberStepper as SadaNumberStepper,
  type SADACounterProps,
  type SADANumberStepperProps,
  type SadaNumberStepperProps,
} from "./sada-counter";
export {
  SADARadioGroup,
  SADARadioGroup as SadaRadioGroup,
  SADARadioItem,
  SADARadioItem as SADARadio,
  SADARadioItem as SadaRadio,
  type SADARadioGroupProps,
  type SADARadioItemProps,
  type SADARadioOption,
} from "./sada-radio";

// Search & Filtering
export {
  SADASearch,
  SADASearch as SadaSearch,
  type SADASearchProps,
} from "./sada-search";
export {
  SADAFilterBar,
  SADAFilterBar as SadaFilterBar,
  type SADAFilterBarProps,
} from "./sada-filter-bar";

// Surfaces & Badges
export {
  SADABadge,
  SADABadge as SadaBadge,
  sadaBadgeVariants,
  type SADABadgeProps,
} from "./sada-badge";
export {
  SADACard,
  SADACard as SadaCard,
  SADACardHeader,
  SADACardTitle,
  SADACardDescription,
  SADACardContent,
  SADACardFooter,
} from "./sada-card";

// Canonical Numerical Typography
export {
  SADANumber,
  SADANumber as SadaNumber,
  type SADANumberProps,
} from "./sada-number";

// States & Feedback
export {
  SADAEmptyState,
  SADAEmptyState as SadaEmptyState,
  type SADAEmptyStateProps,
} from "./sada-empty-state";
export {
  Skeleton,
  SADASkeleton,
  SADASkeleton as SadaSkeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SADACardSkeleton,
  SADACardSkeleton as SadaCardSkeleton,
  SkeletonMetric,
  SkeletonTable,
  SADATableSkeleton,
  SADATableSkeleton as SadaTableSkeleton,
  SkeletonRow,
  SkeletonChart,
  SkeletonList,
  SADAListSkeleton,
  SADAListSkeleton as SadaListSkeleton,
  SkeletonPageHeader,
  SADAContentTransition,
  type SkeletonProps,
  type SkeletonTextProps,
  type SkeletonTitleProps,
  type SkeletonAvatarProps,
  type SkeletonButtonProps,
  type SkeletonCardProps,
  type SkeletonMetricProps,
  type SkeletonTableProps,
  type SkeletonRowProps,
  type SkeletonChartProps,
  type SkeletonListProps,
  type SkeletonPageHeaderProps,
  type SADAContentTransitionProps,
} from "./sada-skeleton";
export {
  ExecutiveDashboardSkeleton,
  FinanceDashboardSkeleton,
  AnalyticsDashboardSkeleton,
  SalesPipelineSkeleton,
  TeamWorkloadSkeleton,
  MySalarySkeleton,
  MyWorkSkeleton,
  ClientDirectorySkeleton,
  ClientWorkspaceSkeleton,
  WorkspaceListSkeleton,
  WorkspaceDetailSkeleton,
  AccountsDirectorySkeleton,
  BusinessRulesSkeleton,
  NotificationCenterSkeleton,
  CalendarDashboardSkeleton,
} from "./sada-page-skeletons";
export {
  SADAErrorState,
  SADAErrorState as SadaErrorState,
  type SADAErrorStateProps,
} from "./sada-error-state";

export {
  SADAWindow,
  SADAWindow as SadaWindow,
  SADAWindowOverlay,
  SADAWindowHeader,
  SADAWindowHeader as SadaWindowHeader,
  SADAWindowBody,
  SADAWindowBody as SadaWindowBody,
  SADAWindowFooter,
  SADAWindowFooter as SadaWindowFooter,
  SADADialog,
  SADADialog as SadaDialog,
  SADADialog as SadaModal,
  SADADialog as SADAModal,
  type SADADialogProps,
  type SADAWindowProps,
  type SADAWindowHeaderProps,
  type SADAWindowBodyProps,
  type SADAWindowFooterProps,
  type SADAWindowSize,
} from "./sada-dialog";
export {
  SADADrawer,
  SADADrawer as SadaDrawer,
  type SADADrawerProps,
} from "./sada-drawer";
export {
  SADAConfirmDialog,
  SADAConfirmDialog as SadaConfirmDialog,
  type SADAConfirmDialogProps,
} from "./sada-confirm-dialog";

// Tabs, Tooltips, Popovers, Toasts, Progress
export {
  Tabs as SADATabs,
  Tabs as SadaTabs,
  TabsList as SADATabsList,
  TabsList as SadaTabsList,
  TabsTrigger as SADATabsTrigger,
  TabsTrigger as SadaTabsTrigger,
  TabsContent as SADATabsContent,
  TabsContent as SadaTabsContent,
};

export {
  Tooltip as SADATooltip,
  Tooltip as SadaTooltip,
  TooltipTrigger as SADATooltipTrigger,
  TooltipTrigger as SadaTooltipTrigger,
  TooltipContent as SADATooltipContent,
  TooltipContent as SadaTooltipContent,
  TooltipProvider as SADATooltipProvider,
  TooltipProvider as SadaTooltipProvider,
};

export {
  Popover as SADAPopover,
  Popover as SadaPopover,
  PopoverTrigger as SADAPopoverTrigger,
  PopoverTrigger as SadaPopoverTrigger,
  PopoverContent as SADAPopoverContent,
  PopoverContent as SadaPopoverContent,
};

export {
  Progress as SADAProgress,
  Progress as SadaProgress,
};

export const SADAToast = toast;
export const SadaToast = toast;
