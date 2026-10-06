import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Texte secondaire affiché sous le libellé. */
  hint?: string;
}

export type MenuEntry = MenuItem | "separator";

export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuEntry[];
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: menu.y, left: menu.x });

  // Garde le menu dans la fenêtre lorsqu'il est ouvert près d'un bord.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      top: Math.max(4, Math.min(menu.y, window.innerHeight - height - 4)),
      left: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
    });
  }, [menu]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="min-w-44 max-w-96 max-h-[80vh] overflow-y-auto bg-[#1e2030] border border-white/10 rounded shadow-xl py-1 select-none"
    >
      {menu.items.map((entry, i) =>
        entry === "separator" ? (
          <div key={i} className="my-1 border-t border-white/10" />
        ) : (
          <button
            key={i}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-default ${
              entry.danger
                ? "text-red-400 hover:bg-red-900/30"
                : "text-[var(--color-text)] hover:bg-white/10"
            }`}
            disabled={entry.disabled}
            onClick={() => {
              entry.action();
              onClose();
            }}
          >
            <span className="block truncate">{entry.label}</span>
            {entry.hint && (
              <span className="block truncate text-[10px] text-[var(--color-muted)] font-mono">{entry.hint}</span>
            )}
          </button>
        )
      )}
    </div>,
    document.body
  );
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  function open(e: React.MouseEvent, items: MenuEntry[]) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  function close() {
    setMenu(null);
  }

  return { menu, open, close };
}
