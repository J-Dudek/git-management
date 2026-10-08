import { useState } from "react";
import { Keyboard, Palette, RefreshCw, RotateCcw, SquareTerminal, type LucideIcon } from "lucide-react";
import { Modal } from "./Modal";
import { Kbd } from "./Kbd";
import {
  ROW_HEIGHTS, SYNC_INTERVALS, TERMINAL_FONT_MAX, TERMINAL_FONT_MIN, ZOOM_STEPS, defaultDisplay, useDisplayStore, type Density,
} from "../store/useDisplayStore";
import { syncOpenRepos } from "../lib/autoSync";

type Section = "appearance" | "terminal" | "sync" | "shortcuts";

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
  { id: "sync", label: "Synchronisation", icon: RefreshCw },
  { id: "shortcuts", label: "Raccourcis", icon: Keyboard },
];

/** Préférences de l'application : appliquées immédiatement et partagées entre les fenêtres. */
export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>("appearance");
  const reset = useDisplayStore((s) => s.reset);

  return (
    <Modal title="Préférences" onClose={onClose} width="w-[720px]">
      <div className="flex h-[460px] max-h-[64vh] text-xs text-[var(--color-text)]">
        <nav className="w-48 shrink-0 p-2 border-r border-white/10 bg-black/10 flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                section === id
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/5"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} className={section === id ? "text-[var(--color-accent)]" : ""} />
              {label}
            </button>
          ))}
          <p className="mt-auto px-2.5 pb-1 text-[10px] leading-relaxed text-[var(--color-muted)]">
            Les modifications sont appliquées immédiatement à toutes les fenêtres.
          </p>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {section === "appearance" && <AppearanceSection />}
            {section === "terminal" && <TerminalSection />}
            {section === "sync" && <SyncSection />}
            {section === "shortcuts" && <ShortcutsSection />}
          </div>
          {section !== "shortcuts" && (
            <div className="flex justify-end px-6 py-3 border-t border-white/10">
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-white/10"
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Apparence

const DENSITIES: { value: Density; label: string }[] = [
  { value: "compact", label: "Compacte" },
  { value: "normal", label: "Normale" },
  { value: "comfortable", label: "Aérée" },
];

function AppearanceSection() {
  const zoom = useDisplayStore((s) => s.zoom);
  const density = useDisplayStore((s) => s.density);
  const update = useDisplayStore((s) => s.update);
  const index = Math.max(0, ZOOM_STEPS.findIndex((z) => Math.abs(z - zoom) < 1e-6));

  return (
    <>
      <SectionTitle title="Apparence" subtitle="Taille et densité de l'interface." />

      <Group
        title="Taille de l'interface"
        description="Agrandit ou réduit tout : textes, panneaux, graphe et terminal."
        value={`${Math.round(zoom * 100)} %`}
      >
        <Slider
          min={0}
          max={ZOOM_STEPS.length - 1}
          value={index}
          onChange={(i) => update({ zoom: ZOOM_STEPS[i] })}
          ticks={ZOOM_STEPS.map((z) => `${Math.round(z * 100)}`)}
          defaultIndex={ZOOM_STEPS.indexOf(defaultDisplay.zoom)}
        />
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
          <Kbd keys="Ctrl+=" /> agrandir <span className="mx-1">·</span>
          <Kbd keys="Ctrl+-" /> réduire <span className="mx-1">·</span>
          <Kbd keys="Ctrl+0" /> 100 %
        </p>
      </Group>

      <Group title="Densité du graphe" description="Hauteur des lignes de l'historique des commits.">
        <div className="grid grid-cols-3 gap-2.5">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              onClick={() => update({ density: d.value })}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                density === d.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40"
                  : "border-white/10 hover:border-white/25 hover:bg-white/5"
              }`}
            >
              <DensityPreview rowHeight={ROW_HEIGHTS[d.value]} />
              <span className="mt-2 flex items-baseline justify-between">
                <span className="font-medium">{d.label}</span>
                <span className="text-[10px] text-[var(--color-muted)] font-mono">{ROW_HEIGHTS[d.value]} px</span>
              </span>
            </button>
          ))}
        </div>
      </Group>
    </>
  );
}

/** Mini graphe : trois commits espacés selon la hauteur de ligne. */
function DensityPreview({ rowHeight }: { rowHeight: number }) {
  const gap = rowHeight * 0.55;
  const ys = [10, 10 + gap, 10 + gap * 2];
  return (
    <svg viewBox="0 0 120 64" className="w-full h-14 rounded bg-black/25">
      <line x1="16" y1={ys[0]} x2="16" y2={ys[2]} stroke="#e94560" strokeWidth="2" />
      {ys.map((y, i) => (
        <g key={i}>
          <circle cx="16" cy={y} r="4" fill="#1a1b26" stroke="#e94560" strokeWidth="2" />
          <rect x="28" y={y - 2.5} width={i === 1 ? 60 : 78} height="5" rx="2.5" fill="#ffffff" opacity="0.18" />
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- Terminal

function TerminalSection() {
  const fontSize = useDisplayStore((s) => s.terminalFontSize);
  const update = useDisplayStore((s) => s.update);

  return (
    <>
      <SectionTitle title="Terminal" subtitle="Terminal intégré du panneau du bas." />
      <Group title="Taille du texte" description="S'applique aussi aux terminaux déjà ouverts." value={`${fontSize} px`}>
        <Slider
          min={TERMINAL_FONT_MIN}
          max={TERMINAL_FONT_MAX}
          value={fontSize}
          onChange={(v) => update({ terminalFontSize: v })}
          ticks={[`${TERMINAL_FONT_MIN}`, "", "", `${defaultDisplay.terminalFontSize}`, ...Array(TERMINAL_FONT_MAX - TERMINAL_FONT_MIN - 4).fill(""), `${TERMINAL_FONT_MAX}`]}
          defaultIndex={defaultDisplay.terminalFontSize - TERMINAL_FONT_MIN}
        />
      </Group>
      <Group title="Aperçu">
        <div
          className="rounded-lg border border-white/10 bg-[var(--color-bg-primary)] px-3 py-2.5 overflow-hidden"
          style={{ fontFamily: "ui-monospace, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace", fontSize, lineHeight: 1.35 }}
        >
          <div className="whitespace-nowrap">
            <span className="text-green-400">j6n@merathon</span>:<span className="text-sky-400">~/projet</span>$ git status
          </div>
          <div className="whitespace-nowrap text-[var(--color-text)]">Sur la branche main</div>
          <div className="whitespace-nowrap text-red-400">	modifié :         src/App.tsx</div>
        </div>
      </Group>
      <p className="text-[10px] text-[var(--color-muted)] flex items-center gap-1.5">
        Dans le terminal : <Kbd keys="Ctrl+Maj+C" /> copier <span className="mx-1">·</span> <Kbd keys="Ctrl+Maj+V" /> coller
      </p>
    </>
  );
}

// ---------------------------------------------------------------- Synchronisation

function syncLabel(minutes: number): string {
  if (minutes === 0) return "Désactivée";
  return minutes === 60 ? "1 h" : `${minutes} min`;
}

function syncTick(minutes: number): string {
  if (minutes === 0) return "off";
  // Sans espace : les graduations sont des colonnes de largeur nulle, « 1 h » passerait sur deux lignes.
  return minutes === 60 ? "1h" : `${minutes}`;
}

function SyncSection() {
  const interval = useDisplayStore((s) => s.syncInterval);
  const update = useDisplayStore((s) => s.update);
  const [syncing, setSyncing] = useState(false);
  const index = Math.max(0, SYNC_INTERVALS.indexOf(interval));

  async function syncNow() {
    setSyncing(true);
    try {
      await syncOpenRepos();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <SectionTitle title="Synchronisation" subtitle="Surveillance des dépôts ouverts dans les onglets." />
      <Group
        title="Intervalle"
        description="Fetch de chaque dépôt ouvert et actualisation de ses PR / MR ; une notification résume les changements."
        value={syncLabel(interval)}
      >
        <Slider
          min={0}
          max={SYNC_INTERVALS.length - 1}
          value={index}
          onChange={(i) => update({ syncInterval: SYNC_INTERVALS[i] })}
          ticks={SYNC_INTERVALS.map(syncTick)}
          defaultIndex={SYNC_INTERVALS.indexOf(defaultDisplay.syncInterval)}
        />
      </Group>
      <button
        onClick={syncNow}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 hover:bg-white/10 disabled:opacity-50"
      >
        <RefreshCw size={13} strokeWidth={1.75} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Raccourcis

const SHORTCUTS: { group: string; items: [string, string][] }[] = [
  {
    group: "Général",
    items: [
      ["Ouvrir un dépôt", "Ctrl+O"],
      ["Préférences", "Ctrl+,"],
      ["Rafraîchir le dépôt", "F5"],
      ["Revenir au graphe", "Échap"],
    ],
  },
  {
    group: "Onglets et fenêtres",
    items: [
      ["Nouvel onglet", "Ctrl+T"],
      ["Fermer l'onglet", "Ctrl+W"],
      ["Onglet suivant", "Ctrl+Tab"],
      ["Onglet précédent", "Ctrl+Maj+Tab"],
      ["Nouvelle fenêtre", "Ctrl+Maj+N"],
    ],
  },
  {
    group: "Affichage",
    items: [
      ["Agrandir l'interface", "Ctrl+="],
      ["Réduire l'interface", "Ctrl+-"],
      ["Taille par défaut", "Ctrl+0"],
      ["Afficher / masquer le panneau du bas", "Ctrl+J"],
    ],
  },
  {
    group: "Terminal",
    items: [
      ["Copier la sélection", "Ctrl+Maj+C"],
      ["Coller", "Ctrl+Maj+V"],
    ],
  },
];

function ShortcutsSection() {
  return (
    <>
      <SectionTitle title="Raccourcis clavier" subtitle="Quand le terminal a le focus, les touches vont au shell." />
      {SHORTCUTS.map(({ group, items }) => (
        <div key={group} className="mb-5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{group}</p>
          <div className="rounded-lg border border-white/10 divide-y divide-white/5">
            {items.map(([label, keys]) => (
              <div key={label} className="flex items-center justify-between px-3 py-2">
                <span>{label}</span>
                <Kbd keys={keys} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Éléments communs

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-[var(--color-muted)]">{subtitle}</p>
    </div>
  );
}

function Group({ title, description, value, children }: {
  title: string;
  description?: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{description}</p>}
        </div>
        {value && (
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-white/[0.07] font-mono text-[11px] tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Curseur à crans, avec graduations ; le cran par défaut est souligné. */
function Slider({ min, max, value, onChange, ticks, defaultIndex }: {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ticks: string[];
  defaultIndex: number;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pref-slider w-full"
        style={{ "--fill": `${percent}%` } as React.CSSProperties}
      />
      <div className="mt-1 flex justify-between px-[7px]">
        {ticks.map((t, i) => (
          <span
            key={i}
            className={`w-0 flex justify-center text-[9px] tabular-nums ${
              i === defaultIndex ? "text-[var(--color-text)] font-semibold" : "text-[var(--color-muted)]"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
