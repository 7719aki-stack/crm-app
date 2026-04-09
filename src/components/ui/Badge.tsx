interface BadgeProps {
  children: React.ReactNode;
  variant?: "purple" | "blue" | "green" | "yellow" | "gray" | "red";
  size?: "sm" | "md";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  purple: "bg-brand-100 text-brand-700",
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  gray:   "bg-gray-100 text-gray-600",
  red:    "bg-red-100 text-red-700",
};

export function Badge({ children, variant = "gray", size = "sm" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
