import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import "./Checkbox.css";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function Checkbox({ checked, onToggle, size = "md", ariaLabel }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel ?? (checked ? "Mark as not done" : "Mark as done")}
      data-size={size}
      className={cn("checkbox", checked && "checked")}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Check
        className="check"
        size={size === "sm" ? 12 : 14}
        strokeWidth={3}
      />
    </button>
  );
}
