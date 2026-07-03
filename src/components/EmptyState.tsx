import { Fragment } from "react";
import { CheckCircle2, Sailboat, Stars } from "lucide-react";
import { View } from "@/types";
import "./EmptyState.css";

interface EmptyStateProps {
  view: View;
}

export function EmptyState({ view }: EmptyStateProps) {
  const data = describe(view);
  return (
    <div className="empty-state">
      <div className="empty-icon" data-kind={data.tone}>
        {data.tone === "ship" ? (
          <Sailboat size={36} strokeWidth={1.4} />
        ) : data.tone === "complete" ? (
          <CheckCircle2 size={36} strokeWidth={1.4} />
        ) : (
          <Stars size={36} strokeWidth={1.4} />
        )}
      </div>
      <h2 className="empty-title">{data.title}</h2>
      <p className="empty-body">{data.body}</p>
      {data.hint && (
        <span className="empty-hint" role="note">
          {data.hint}
        </span>
      )}
    </div>
  );
}

/* Inline kbd group: <KbdGroup keys={["Ctrl","N"]} /> → [Ctrl]+[N]
 * Each token becomes a real <kbd class="kbd">. Used in the hint copy
 * so the keyboard affordance shows up at the same visual weight as the
 * Settings-modal keyboard list. */
function KbdGroup({ keys }: { keys: string[] }) {
  return (
    <>
      {keys.map((k, i) => (
        <Fragment key={`${k}-${i}`}>
          {i > 0 && (
            <span className="empty-kbd-plus" aria-hidden>
              +
            </span>
          )}
          <kbd className="kbd">{k}</kbd>
        </Fragment>
      ))}
    </>
  );
}

function describe(view: View): {
  tone: "ship" | "all" | "complete";
  title: string;
  body: string;
  hint?: React.ReactNode;
} {
  switch (view.kind) {
    case "today":
      return {
        tone: "ship",
        title: "Nothing scheduled today.",
        body: "Open day. Use it deliberately or just breathe.",
      };
    case "upcoming":
      return {
        tone: "ship",
        title: "Next 7 days are wide open.",
        body: "Nothing planned. Either liberating or alarming.",
      };
    case "inbox":
      return {
        tone: "all",
        title: "Inbox is zero.",
        body: "Capture a thought here and decide what to do with it later.",
        hint: (
          <>
            Press <KbdGroup keys={["Ctrl", "N"]} /> to add a task
            <span className="empty-kbd-sep" aria-hidden>
              {" · "}
            </span>
            <KbdGroup keys={["Ctrl", ","]} /> for settings
          </>
        ),
      };
    case "all":
      return {
        tone: "all",
        title: "All done.",
        body: "Every task has been completed. Take a victory lap.",
      };
    case "completed":
      return {
        tone: "complete",
        title: "No history yet.",
        body: "Once you complete tasks they'll show up here. Settings, themes, and shortcuts live under Ctrl ,.",
        hint: (
          <>
            <KbdGroup keys={["Ctrl", ","]} /> to open settings
          </>
        ),
      };
    case "project":
      return {
        tone: "all",
        title: "Empty project.",
        body: "Add tasks to scope out what this project is for.",
        hint: (
          <>
            Press <KbdGroup keys={["Ctrl", "N"]} /> to add a task
            <span className="empty-kbd-sep" aria-hidden>
              {" · "}
            </span>
            <KbdGroup keys={["Ctrl", ","]} /> for settings
          </>
        ),
      };
    case "label":
      return {
        tone: "all",
        title: "No tasks with this label.",
        body: "Tag tasks with this label to see them here.",
      };
    case "search":
      return {
        tone: "all",
        title: "No matches.",
        body: "Try a different query.",
      };
  }
  return { tone: "all", title: "Nothing here.", body: "" };
}
