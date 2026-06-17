import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-300 font-semibold text-zinc-950 hover:bg-emerald-200 focus-visible:ring-emerald-200 disabled:bg-zinc-700 disabled:text-zinc-400",
  secondary:
    "border border-zinc-700 font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900 focus-visible:ring-emerald-200 disabled:border-zinc-800 disabled:text-zinc-600",
  danger:
    "bg-red-500 font-semibold text-white hover:bg-red-400 focus-visible:ring-red-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-8 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    />
  );
});
