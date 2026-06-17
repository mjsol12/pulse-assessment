import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed light:focus-visible:ring-offset-white";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-300 font-semibold text-zinc-950 hover:bg-emerald-200 focus-visible:ring-emerald-200 disabled:bg-zinc-700 disabled:text-zinc-400 light:bg-emerald-500 light:text-white light:hover:bg-emerald-600 light:focus-visible:ring-emerald-500 light:disabled:bg-slate-200 light:disabled:text-slate-400",
  secondary:
    "border border-zinc-700 font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:ring-emerald-200 disabled:border-zinc-800 disabled:text-zinc-600 light:border-slate-300 light:text-slate-700 light:hover:border-slate-400 light:hover:bg-slate-100 light:focus-visible:ring-emerald-500 light:disabled:border-slate-200 light:disabled:text-slate-400",
  danger:
    "bg-red-500 font-semibold text-white hover:bg-red-400 focus-visible:ring-red-200 light:bg-red-600 light:hover:bg-red-700 light:focus-visible:ring-red-500",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 text-sm",
  md: "min-h-11 text-sm",
  lg: "min-h-12 text-base",
};

const sizePadding: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
  lg: "px-8 py-3",
};

const iconOnlyPadding: Record<ButtonSize, string> = {
  sm: "min-w-10 px-0 py-1.5 md:min-w-0 md:px-3",
  md: "min-w-11 px-0 py-2 md:min-w-0 md:px-4",
  lg: "min-w-12 px-0 py-3 md:min-w-0 md:px-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Icon on all viewports; label visible from md breakpoint up. */
  responsiveLabel?: boolean;
}

function buttonLabel(children: ReactNode): string | undefined {
  if (typeof children === "string") return children;
  return undefined;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    responsiveLabel = false,
    className = "",
    type = "button",
    children,
    ...props
  },
  ref,
) {
  const label = buttonLabel(children);
  const useResponsive = responsiveLabel && icon && label;

  return (
    <button
      ref={ref}
      type={type}
      aria-label={useResponsive ? label : undefined}
      className={[
        base,
        variants[variant],
        sizes[size],
        useResponsive ? iconOnlyPadding[size] : sizePadding[size],
        useResponsive ? "gap-0 md:gap-2" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {icon}
      {useResponsive ? (
        <span className="hidden md:inline" aria-hidden="true">
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
});
