import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width = "w-[420px]" }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[12vh] bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`${width} max-w-[92vw] max-h-[76vh] flex flex-col bg-[#1e2030] border border-white/10 rounded-lg shadow-2xl`}>
        <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-white/10">
          <span className="text-sm font-semibold text-[var(--color-text)]">{title}</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            title="Fermer (Échap)"
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/10"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export const inputClass =
  "bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]/60 placeholder:text-[var(--color-muted)] w-full";

export function Button({ onClick, disabled, variant = "default", children, title, type = "button" }: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  children: React.ReactNode;
  title?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    default: "bg-white/10 hover:bg-white/15 text-[var(--color-text)]",
    primary: "bg-[var(--color-accent)] hover:opacity-90 text-white font-semibold",
    danger: "bg-red-700/80 hover:bg-red-700 text-white font-semibold",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-default ${styles}`}
    >
      {children}
    </button>
  );
}
