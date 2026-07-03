import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ColorKey } from "@/types";
import { useStore } from "@/store";
import { ColorPicker } from "./ColorPicker";
import "./Editor.css";

interface LabelEditorProps {
  mode: "new" | "edit";
  labelId?: string;
}

export function LabelEditor({ mode, labelId }: LabelEditorProps) {
  const labels = useStore((s) => s.labels);
  const create = useStore((s) => s.createLabel);
  const update = useStore((s) => s.updateLabel);
  const remove = useStore((s) => s.deleteLabel);
  const close = useStore((s) => s.closeModal);

  const existing = mode === "edit" ? labels.find((l) => l.id === labelId) : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState<ColorKey>(existing?.color ?? "slate");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, color]);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    if (mode === "edit" && existing) update(existing.id, { name: n, color });
    else create({ name: n, color });
    close();
  };

  return (
    <div className="editor">
      <h2 className="editor-title">
        {mode === "edit" ? "Edit label" : "New label"}
      </h2>
      <p className="editor-subtitle">
        Tag tasks to slice the same data many ways.
      </p>

      <label className="editor-row">
        <span className="editor-label">Name</span>
        <input
          className="editor-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Urgent, Reading, Maybe"
          maxLength={32}
        />
      </label>

      <div className="editor-row">
        <span className="editor-label">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="editor-footer">
        {mode === "edit" && (
          <button
            className="editor-danger"
            onClick={() => {
              if (existing) {
                remove(existing.id);
                close();
              }
            }}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Delete
          </button>
        )}
        <div className="editor-actions">
          <button className="editor-secondary" onClick={close}>Cancel</button>
          <button
            className="editor-primary"
            onClick={save}
            disabled={!name.trim()}
          >
            {mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
