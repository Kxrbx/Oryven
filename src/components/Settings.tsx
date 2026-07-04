import { Fragment, useEffect, useState } from "react";
import {
  Keyboard,
  Moon,
  Sun,
  Sparkles,
  Trash2,
  AlertTriangle,
  Database,
  ArrowDownAZ,
  ListOrdered,
  SlidersHorizontal,
  Info,
  Check,
} from "lucide-react";
import { useStore } from "@/store";
import { stateLocation } from "@/lib/tauri";
import { cn } from "@/utils/cn";
import "./Settings.css";

type SectionId = "appearance" | "lists" | "behavior" | "data" | "keyboard" | "about";

const SECTIONS: Array<{ id: SectionId; label: string; Icon: React.ElementType }> = [
  { id: "appearance", label: "Appearance", Icon: SlidersHorizontal },
  { id: "lists", label: "Lists & sorting", Icon: ArrowDownAZ },
  { id: "behavior", label: "Behavior", Icon: Sparkles },
  { id: "data", label: "Data", Icon: Database },
  { id: "keyboard", label: "Keyboard", Icon: Keyboard },
  { id: "about", label: "About", Icon: Info },
];

const SORT_MODES: Array<{
  value: "smart" | "due" | "alpha" | "manual";
  label: string;
  hint: string;
}> = [
  {
    value: "smart",
    label: "Smart",
    hint: "Priority first, then due date, then your manual order.",
  },
  {
    value: "due",
    label: "Due date",
    hint: "Soonest first. Tasks without a date sink to the bottom.",
  },
  {
    value: "alpha",
    label: "Alphabetical",
    hint: "A → Z by title. Predictable for review and cleanup.",
  },
  {
    value: "manual",
    label: "Manual",
    hint: "Drag rows to reorder. Most recent on top by default.",
  },
];

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["Ctrl/Cmd", "K"], label: "Open command palette" },
  { keys: ["Ctrl/Cmd", ","], label: "Open settings" },
  { keys: ["Ctrl/Cmd", "N"], label: "Capture a new task" },
  { keys: ["Ctrl/Cmd", "B"], label: "Toggle sidebar" },
  { keys: ["Ctrl/Cmd", "Shift", "L"], label: "Switch theme" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["g", "i"], label: "Go to Inbox" },
  { keys: ["g", "t"], label: "Go to Today" },
  { keys: ["g", "u"], label: "Go to Upcoming" },
  { keys: ["g", "a"], label: "Go to All tasks" },
  { keys: ["g", "c"], label: "Go to Completed" },
  { keys: ["j"], label: "Next task" },
  { keys: ["k"], label: "Previous task" },
  { keys: ["Enter"], label: "Open selected task" },
  { keys: ["Esc"], label: "Close dialogs" },
  { keys: ["Ctrl/Cmd", "Backspace"], label: "Delete selected task" },
];

const VIEW_SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["Ctrl/Cmd", "Alt", "1"], label: "List view" },
  { keys: ["Ctrl/Cmd", "Alt", "2"], label: "Kanban view" },
  { keys: ["Ctrl/Cmd", "Alt", "3"], label: "Calendar view" },
  { keys: ["Ctrl/Cmd", "Alt", "4"], label: "Table view" },
];

export function Settings() {
  // Per-section local UI state resets on each remount so closing and
  // reopening Settings starts on the section the user was last on.
  // We re-mount the pane on switch (via `key={section}` below) so each
  // section gets a fresh entrance animation without gating visibility.
  const [section, setSection] = useState<SectionId>("appearance");

  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const resetAll = useStore((s) => s.resetAll);
  const close = useStore((s) => s.closeModal);

  // Reset confirmation: a single click arms the button; the next click
  // within 6 seconds commits. We never destroy data on a single click.
  const [resetArmed, setResetArmed] = useState(false);
  useEffect(() => {
    if (!resetArmed) return;
    const t = window.setTimeout(() => setResetArmed(false), 6000);
    return () => window.clearTimeout(t);
  }, [resetArmed]);

  return (
    <div className="editor settings-root">
      <header className="settings-header">
        <h2 className="editor-title">Settings</h2>
        <p className="editor-subtitle">
          Tune how Oryven feels. Changes save instantly.
        </p>
      </header>

      <div className="settings-body">
        <nav className="settings-rail" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={cn("settings-rail-item", section === id && "active")}
              onClick={() => setSection(id)}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-pane" key={section}>
          {section === "appearance" && (
            <Section title="Appearance" hint="Switch any time. Oryven remembers.">
              <Row
                label="Theme"
                description="Dark is easy on the eyes at night. Light works in bright rooms."
              >
                <SegmentedControl
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "dark", label: "Dark", Icon: Moon },
                    { value: "light", label: "Light", Icon: Sun },
                  ]}
                />
              </Row>
            </Section>
          )}

          {section === "lists" && (
            <Section title="Lists & sorting" hint="Affects every view except Completed.">
              <PickerRow
                label="Default sort"
                description="How an open list orders its tasks. Drag a row to override."
              >
                <RadioList
                  value={settings.sortMode}
                  onChange={(v) => setSettings({ sortMode: v })}
                  options={SORT_MODES}
                  ariaLabel="Default sort order"
                />
              </PickerRow>

              <Row
                label="Week starts on"
                description="Affects the Recurring dialog. Future week views will follow."
              >
                <SegmentedControl
                  value={String(settings.weekStartsOn)}
                  onChange={(v) =>
                    setSettings({ weekStartsOn: (v === "0" ? 0 : 1) as 0 | 1 })
                  }
                  options={[
                    { value: "1", label: "Monday" },
                    { value: "0", label: "Sunday" },
                  ]}
                />
              </Row>
            </Section>
          )}

          {section === "behavior" && (
            <Section title="Behavior" hint="Sensible defaults. Toggle only if you need to.">
              <Row
                label="Confirm before delete"
                description="Show a one-step confirmation before removing the selected task."
              >
                <Switch
                  checked={settings.confirmBeforeDelete}
                  onChange={(v) => setSettings({ confirmBeforeDelete: v })}
                />
              </Row>
              <Row
                label="Recurring tasks"
                description="Completing a recurring task spawns the next occurrence."
              >
                <span className="settings-static">
                  <ListOrdered size={12} strokeWidth={2} />
                  Always on
                </span>
              </Row>
            </Section>
          )}

          {section === "data" && (
            <DataSection
              onResetArmed={() => setResetArmed((v) => !v)}
              resetArmed={resetArmed}
              onConfirmReset={() => {
                resetAll();
                close();
              }}
            />
          )}

          {section === "keyboard" && <KeyboardSection />}
          {section === "about" && <AboutSection />}
        </div>
      </div>

      <footer className="settings-foot">
        <span className="settings-foot-note">Changes save instantly.</span>
        <button className="editor-secondary" onClick={close}>
          Done
        </button>
      </footer>
    </div>
  );
}

/* ─── Building blocks ─────────────────────────────────────────────── */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <header className="settings-section-head">
        <h3 className="settings-section-title">{title}</h3>
        {hint && <p className="settings-section-hint">{hint}</p>}
      </header>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-desc">{description}</div>
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

/**
 * A Row variant whose control is full-width (label/description stack on
 * top, then the control takes the entire row width below). Used for
 * multi-option pickers like Default sort.
 */
function PickerRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row settings-row--picker">
      <div className="settings-row-head">
        <div className="settings-row-label">{label}</div>
        {description && <div className="settings-row-desc">{description}</div>}
      </div>
      <div className="settings-row-picker">{children}</div>
    </div>
  );
}

/**
 * Vertical radio list. Each option is a full-width row with a leading
 * radio dot, bold label, and helper hint. The selected option lights up
 * with the accent-soft background and a filled radio dot. No side-stripes.
 */
function RadioList<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; hint: string }>;
  ariaLabel?: string;
}) {
  return (
    <div className="settings-radio" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={checked}
            className={cn("settings-radio-item", checked && "active")}
            onClick={() => onChange(o.value)}
          >
            <span className="settings-radio-dot" aria-hidden />
            <span className="settings-radio-text">
              <span className="settings-radio-label">{o.label}</span>
              <span className="settings-radio-hint">{o.hint}</span>
            </span>
            {checked && (
              <Check
                size={14}
                strokeWidth={2}
                className="settings-radio-check"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; Icon?: React.ElementType }>;
}) {
  return (
    <div className="settings-segmented" role="radiogroup">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          role="radio"
          aria-checked={value === opt.value}
          className={cn(
            "settings-segmented-item",
            value === opt.value && "active"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.Icon && <opt.Icon size={12} strokeWidth={1.8} />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn("settings-switch", checked && "active")}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-knob" />
    </button>
  );
}

function ShortcutCombo({ keys }: { keys: string[] }) {
  return (
    <span className="settings-key-combo">
      {keys.map((k, i) => (
        <Fragment key={`${k}-${i}`}>
          {i > 0 && (
            <span className="settings-key-plus" aria-hidden>
              +
            </span>
          )}
          <kbd className="settings-kbd">{k}</kbd>
        </Fragment>
      ))}
    </span>
  );
}

function DataSection({
  resetArmed,
  onResetArmed,
  onConfirmReset,
}: {
  resetArmed: boolean;
  onResetArmed: () => void;
  onConfirmReset: () => void;
}) {
  const [loc, setLoc] = useState<string>("—");
  useEffect(() => {
    let live = true;
    stateLocation().then((p) => {
      if (live) setLoc(p);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Section title="Data" hint="Everything lives on this device.">
      <Row
        label="Storage"
        description="Where Oryven writes your tasks, projects, and labels."
      >
        <span className="settings-static" title={loc}>
          <Database size={12} strokeWidth={2} />
          {loc}
        </span>
      </Row>

      <Row
        label="Reset everything"
        description="Wipes all tasks, projects, and labels. The app returns to its first-launch state."
      >
        {resetArmed ? (
          <button
            className="settings-danger-solid"
            onClick={onConfirmReset}
            autoFocus
          >
            <AlertTriangle size={13} strokeWidth={2} />
            Click again to confirm
          </button>
        ) : (
          <button className="settings-danger-outline" onClick={onResetArmed}>
            <Trash2 size={13} strokeWidth={1.8} />
            Reset all data
          </button>
        )}
      </Row>
    </Section>
  );
}

function KeyboardSection() {
  return (
    <Section title="Keyboard" hint="Every shortcut in one place.">
      <div className="settings-keys">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="settings-key-row">
            <ShortcutCombo keys={s.keys} />
            <span className="settings-key-label">{s.label}</span>
          </div>
        ))}
        <div className="settings-keys-divider" aria-hidden>
          View layouts
        </div>
        {VIEW_SHORTCUTS.map((s) => (
          <div key={s.label} className="settings-key-row">
            <ShortcutCombo keys={s.keys} />
            <span className="settings-key-label">{s.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AboutSection() {
  return (
    <Section title="About" hint="Local-first. Yours.">
      <div className="settings-about">
        <div className="settings-about-mark" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 923.61 923.61" width="32" height="32">
            <g fill="#4a69d3">
              <path d="M324.66 820.69 c-7.59 -3.87 -10.78 -16.24 -6.00 -24.11 c1.35 -2.33 10.53 -9.28 21.92 -16.71 c43.72 -28.45 71.39 -53.34 101.77 -91.38 c18.49 -23.05 31.84 -43.77 43.84 -68.03 c9.31 -18.71 27.19 -63.70 25.96 -65.41 c-0.86 -0.92 -27.55 15.62 -38.09 23.66 c-2.69 2.01 -7.59 5.57 -11.02 7.73 c-3.31 2.33 -6.98 5.10 -8.08 6.34 c-0.98 1.24 -2.33 2.16 -2.94 2.16 c-0.98 0.00 -37.11 30.15 -53.27 44.69 c-96.87 86.59 -153.69 122.46 -220.18 139.31 c-27.06 6.81 -40.17 8.19 -68.58 7.27 c-34.53 -0.92 -59.15 -7.11 -84.87 -21.02 c-13.10 -7.11 -16.78 -11.14 -17.88 -19.18 c-0.61 -4.94 -0.12 -6.34 3.55 -10.97 c3.92 -4.94 4.65 -5.25 15.06 -6.19 c44.45 -3.71 67.48 -8.81 99.81 -22.43 c37.47 -15.92 69.93 -36.18 106.54 -66.79 c48.00 -40.05 79.11 -73.30 186.14 -199.30 c91.85 -108.07 123.56 -142.24 172.06 -184.77 c37.23 -32.63 103.97 -76.07 121.36 -79.16 c6.00 -0.92 11.27 2.33 14.45 8.81 c5.51 11.91 -1.96 102.51 -14.08 170.09 c-29.88 165.91 -92.83 297.80 -182.22 381.76 c-19.23 18.09 -28.66 25.52 -50.94 39.89 c-35.64 23.05 -71.03 37.26 -106.91 42.82 c-16.04 2.63 -43.23 3.09 -47.39 0.92"/>
              <path d="M-3.17 718.49 c-15.19 -1.71 -37.11 -7.27 -43.47 -10.97 c-6.98 -4.18 -27.55 -27.53 -42.13 -47.92 c-57.43 -80.55 -91.85 -181.67 -100.30 -294.24 c-2.82 -39.28 -0.98 -99.88 4.41 -139.93 c12.00 -88.75 45.92 -179.98 92.46 -248.16 c13.35 -19.80 42.37 -55.21 57.07 -69.88 c66.01 -66.17 141.69 -105.14 227.53 -117.21 c35.39 -5.10 87.07 -2.94 122.46 4.80 c159.69 35.25 285.46 175.19 328.81 365.99 c7.47 32.78 6.74 37.10 -7.72 47.62 c-49.23 35.56 -74.33 57.52 -109.72 95.56 c-24.00 25.97 -24.49 26.44 -29.02 26.44 c-2.20 0.00 -5.39 -0.78 -7.10 -1.85 c-5.88 -3.25 -6.98 -7.89 -8.20 -30.62 c-1.96 -41.28 -6.61 -66.34 -18.98 -102.98 c-11.76 -34.95 -28.17 -65.10 -51.31 -94.16 c-53.64 -67.41 -130.05 -98.34 -206.59 -83.50 c-61.35 11.75 -118.30 53.64 -155.89 114.42 c-55.60 89.98 -65.88 211.83 -26.45 313.71 c18.49 47.78 45.43 87.06 81.56 118.75 c24.74 21.81 62.09 41.90 92.21 49.94 c5.76 1.54 12.25 9.12 13.23 15.46 c1.84 12.37 -5.63 20.87 -33.19 38.35 c-65.03 41.13 -121.60 57.06 -179.65 50.41"/>
            </g>
          </svg>
        </div>
        <div className="settings-about-body">
          <div className="settings-about-name">Oryven</div>
          <div className="settings-about-blurb">
            A small, quiet task manager built to stay out of your way.
            Your tasks live only on this device, never on a server.
          </div>
          <div className="settings-about-meta">
            <span className="settings-pill">Local-first</span>
            <span className="settings-pill">Keyboard-driven</span>
            <span className="settings-pill">No account</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
