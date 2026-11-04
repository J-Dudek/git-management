import { tr } from "../i18n";

/** Écran affiché sur mobile : un seul panneau à la fois, au lieu des trois colonnes du bureau. */
export type MobilePane = "left" | "main" | "right";

/** Barre de navigation du bas, sur mobile : dépôt (branches, comptes), historique, détails du commit ou modifications. */
export function MobileNav({ pane, onChange, hasRepo }: { pane: MobilePane; onChange: (pane: MobilePane) => void; hasRepo: boolean }) {
  const items: { id: MobilePane; label: string; hidden?: boolean }[] = [
    { id: "left", label: tr("Dépôt") },
    { id: "main", label: tr("Historique") },
    { id: "right", label: tr("Détails"), hidden: !hasRepo },
  ];
  return (
    <nav aria-label={tr("Écrans de l'application")} className="flex shrink-0 border-t border-overlay/10 bg-[var(--color-bg-secondary)] pb-[env(safe-area-inset-bottom)]">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button
            key={i.id}
            aria-current={pane === i.id ? "page" : undefined}
            onClick={() => onChange(i.id)}
            className={`flex-1 py-3 text-xs ${pane === i.id ? "text-[var(--color-accent)] font-semibold border-t-2 border-[var(--color-accent)] -mt-px" : "text-[var(--color-muted)]"}`}
          >
            {i.label}
          </button>
        ))}
    </nav>
  );
}
