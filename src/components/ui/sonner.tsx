import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({
  expand = true,
  visibleToasts = 3,
  gap = 10,
  offset = 16,
  mobileOffset = 12,
  duration = 5000,
  style,
  ...props
}: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      expand={expand}
      visibleToasts={visibleToasts}
      gap={gap}
      offset={offset}
      mobileOffset={mobileOffset}
      duration={duration}
      style={{
        "--width": "380px",
        ...style,
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:p-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
