import { useEffect, useState } from "react";
import { Trash2, X as XIcon } from "lucide-react";
import { ColorKey } from "@/types";
import { useStore } from "@/store";
import { ColorPicker } from "./ColorPicker";
import "./Editor.css";

interface ProjectEditorProps {
  mode: "new" | "edit";
  projectId?: string;
}

/**
 * Curated emoji library. Picked to be:
 *   - visually distinct (no two read as "the same"),
 *   - broadly supported across Windows/macOS/Linux color fonts,
 *   - asymmetric (no symmetric pairs like "✅/❌").
 *
 * Order matters: it maps 1:1 onto the picker grid below.
 */
const EMOJI_CHOICES: string[] = [
  "🚀", "🎯", "📚", "💼", "🏠", "🎨", "💪", "✨",
  "🔥", "🌱", "💡", "🎵", "🛠️", "📝", "📅", "📦",
  "🌐", "🧠",
];

export function ProjectEditor({ mode, projectId }: ProjectEditorProps) {
  const projects = useStore((s) => s.projects);
  const create = useStore((s) => s.createProject);
  const update = useStore((s) => s.updateProject);
  const remove = useStore((s) => s.deleteProject);
  const close = useStore((s) => s.closeModal);

  const existing = mode === "edit" ? projects.find((p) => p.id === projectId) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState<ColorKey>(existing?.color ?? "indigo");
  const [emoji, setEmoji] = useState<string>(existing?.emoji ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, color, emoji]);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const cleanEmoji = emoji.trim();
    if (mode === "edit" && existing) {
      update(existing.id, { name: n, color, emoji: cleanEmoji });
    } else {
      create({ name: n, color, emoji: cleanEmoji });
    }
    close();
  };

  return (
    <div className="editor">
      <h2 className="editor-title">
        {mode === "edit" ? "Edit project" : "New project"}
      </h2>
      <p className="editor-subtitle">
        Pick a marker, color it, name it — then drop tasks in.
      </p>

      <label className="editor-row">
        <span className="editor-label">Name</span>
        <input
          className="editor-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Personal, Work, Spark"
          maxLength={64}
        />
      </label>

      <div className="editor-row">
        <span className="editor-label">Marker</span>
        <div className="emoji-picker" role="radiogroup" aria-label="Marker">
          <button
            type="button"
            role="radio"
            aria-checked={emoji === ""}
            className={"emoji-tile" + (emoji === "" ? " selected" : "")}
            title="No emoji"
            onClick={() => setEmoji("")}
          >
            <XIcon size={13} strokeWidth={2} />
          </button>
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              className={"emoji-tile" + (emoji === e ? " selected" : "")}
              title={e}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

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
