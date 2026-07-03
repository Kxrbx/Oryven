import { COLOR_KEYS, ColorKey } from "@/types";
import { cn } from "@/utils/cn";
import "./ColorPicker.css";

interface ColorPickerProps {
  value: ColorKey;
  onChange: (k: ColorKey) => void;
  compact?: boolean;
}

export function ColorPicker({ value, onChange, compact }: ColorPickerProps) {
  return (
    <div className={cn("color-picker", compact && "compact")}>
      {COLOR_KEYS.map((k) => (
        <button
          key={k}
          className={cn("cp-dot", `dot-${k}`, value === k && "selected")}
          aria-label={`Color ${k}`}
          onClick={() => onChange(k)}
        />
      ))}
    </div>
  );
}
