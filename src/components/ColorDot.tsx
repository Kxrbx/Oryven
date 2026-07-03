import { ColorKey } from "@/types";
import { cn } from "@/utils/cn";

export function colorClassVar(k: ColorKey): string {
  // Maps to CSS variables defined in theme.css.
  return `var(--c-${k})`;
}

interface ColorDotProps {
  color: ColorKey;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

export function ColorDot({ color, size = "md", pulse, className }: ColorDotProps) {
  return (
    <span
      className={cn(
        "dot",
        `dot-${color}`,
        size === "sm" && "dot-sm",
        size === "lg" && "dot-lg",
        className
      )}
      style={pulse ? { animation: "pulse-dot 1.6s ease-in-out infinite" } : undefined}
      aria-hidden
    />
  );
}

export function useColorClass(k: ColorKey): string {
  return `dot-${k}`;
}
