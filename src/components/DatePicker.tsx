import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { addDays, todayYMD, toYMD, fromYMD, formatLongDate, parseStrictYMD } from "@/utils/dates";
import { cn } from "@/utils/cn";
import "./DatePicker.css";

interface DatePickerProps {
  value: string | null;
  onChange: (ymd: string | null) => void;
  align?: "left" | "right";
}

const PRESETS: Array<{ label: string; delta: number | "today" | "week" | "month" }> = [
  { label: "Today", delta: "today" },
  { label: "Tomorrow", delta: 1 },
  { label: "In 3 days", delta: 3 },
  { label: "Next week", delta: 7 },
  { label: "In 2 weeks", delta: 14 },
  { label: "Next month", delta: "month" },
];

export function DatePicker({ value, onChange, align = "right" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isoText, setIsoText] = useState(value ?? "");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setIsoText(value ?? ""), [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const apply = (delta: number | "today" | "week" | "month") => {
    let result: string;
    if (delta === "today") result = todayYMD();
    else if (delta === "week") result = addDays(todayYMD(), 7);
    else if (delta === "month") {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      result = toYMD(d);
    } else result = addDays(todayYMD(), delta);
    onChange(result);
    setOpen(false);
  };

  const applyIso = () => {
    const parsed = parseStrictYMD(isoText.trim());
    if (parsed) {
      onChange(parsed);
      setOpen(false);
    }
  };

  return (
    <div className="date-picker" ref={ref}>
      <button
        className="dp-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Set due date"
      >
        <CalendarDays size={14} strokeWidth={1.8} />
        <span className="dp-label">Date</span>
      </button>
      {open && (
        <div className={cn("dp-popover", `align-${align}`)} onMouseDown={(e) => e.stopPropagation()}>
          <div className="dp-presets">
            {PRESETS.map(({ label, delta }) => (
              <button key={label} className="dp-preset" onClick={() => apply(delta)}>
                {label}
              </button>
            ))}
          </div>
          <div className="dp-divider" />
          <label className="dp-input-row">
            <span>YYYY-MM-DD</span>
            <input
              type="text"
              value={isoText}
              onChange={(e) => setIsoText(e.target.value)}
              placeholder="2026-09-12"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") applyIso();
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </label>
          {value && (
            <>
              <div className="dp-divider" />
              <div className="dp-current">{formatLongDate(value)}</div>
              <button className="dp-clear" onClick={() => { onChange(null); setOpen(false); }}>
                <X size={13} strokeWidth={2.2} /> Remove date
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Avoid unused import warnings.
void fromYMD;
