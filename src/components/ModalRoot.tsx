import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useStore } from "@/store";
import { ProjectEditor } from "./ProjectEditor";
import { LabelEditor } from "./LabelEditor";
import { Settings } from "./Settings";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import "./ModalRoot.css";

export function ModalRoot() {
  const modal = useStore((s) => s.modal);
  const close = useStore((s) => s.closeModal);

  const active = modal != null;
  useBodyScrollLock(active);
  useEscapeToClose(active, close);

  if (!modal) return null;

  let body: React.ReactNode = null;
  switch (modal.kind) {
    case "project-new":
      body = <ProjectEditor mode="new" />;
      break;
    case "project-edit":
      body = (
        <ProjectEditor
          mode="edit"
          projectId={(modal.props?.projectId as string) ?? ""}
        />
      );
      break;
    case "label-new":
      body = <LabelEditor mode="new" />;
      break;
    case "label-edit":
      body = (
        <LabelEditor
          mode="edit"
          labelId={(modal.props?.labelId as string) ?? ""}
        />
      );
      break;
    case "settings":
      body = <Settings />;
      break;
  }

  // Render into document.body via a portal so the modal lives on its own
  // stacking context, escaping any local transforms / filters / z-index in
  // the .app grid tree.
  // Settings gets the wider .modal-card.large variant.
  const wide = modal.kind === "settings";
  return createPortal(
    <div className="modal-root" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={close} />
      <div className={wide ? "modal-card large pop-in" : "modal-card pop-in"}>
        <button className="modal-close" onClick={close} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>
        {body}
      </div>
    </div>,
    document.body
  );
}
