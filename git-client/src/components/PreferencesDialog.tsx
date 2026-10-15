import { useEffect, useState } from "react";
import {
  Bell, BookOpen, Bug, Check, Copy, ExternalLink, FolderGit2, Info, Keyboard, Monitor, Moon, Palette, RefreshCw, RotateCcw, Scale, ScrollText,
  SquareTerminal, Sun, Trophy, type LucideIcon,
} from "lucide-react";
import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Modal } from "./Modal";
import { Kbd } from "./Kbd";
import { Tooltip } from "./Tooltip";
import {
  ROW_HEIGHTS, SYNC_INTERVALS, TERMINAL_FONT_MAX, TERMINAL_FONT_MIN, ZOOM_STEPS, defaultDisplay, useDisplayStore, type Density,
  type NotificationSettings, type ThemePreference,
} from "../store/useDisplayStore";
import { useUiStore, type PreferencesSection as Section } from "../store/useUiStore";
import { hasNewRewards, useCelebrationStore } from "../store/useCelebrationStore";
import {
  MILESTONE_KINDS, kindEmojis, milestoneTier, nextMilestone, rewardLabel, type MilestoneKind, type Reward, type Tier,
} from "../lib/milestones";
import { syncOpenRepos, useSyncRunning } from "../lib/autoSync";
import { sendTestNotification } from "../lib/prNotifications";
import { checkForUpdates } from "../lib/updater";
import { errorMessage } from "../lib/actions";
import { aboutReport, osLabel, REPO_URL, releaseUrl, versionLabel } from "../lib/about";
import { appInfo, type AppInfo } from "../ipc/commands";
import logo from "../assets/logo.webp";

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
  { id: "sync", label: "Synchronisation", icon: RefreshCw },
  { id: "shortcuts", label: "Raccourcis", icon: Keyboard },
  { id: "activity", label: "Mon activité", icon: Trophy },
  { id: "about", label: "À propos", icon: Info },
];

/** Rubriques sans réglage : pas de bouton « Réinitialiser ». */
const READ_ONLY: Section[] = ["shortcuts", "activity", "about"];

/** Préférences de l'application : appliquées immédiatement et partagées entre les fenêtres. */
export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>(() => useUiStore.getState().preferencesSection);
  const reset = useDisplayStore((s) => s.reset);
  // « Mon activité » n'apparaît qu'après la première récompense : avant, elle gâcherait la surprise.
  const hasRewards = useCelebrationStore((s) => s.milestones.rewards.length > 0);
  const newRewards = useCelebrationStore((s) => hasNewRewards(s.milestones));
  const sections = SECTIONS.filter((s) => s.id !== "activity" || hasRewards);

  return (
    <Modal title="Préférences" onClose={onClose} width="w-[720px]">
      <div className="flex h-[460px] max-h-[64vh] text-xs text-[var(--color-text)]">
        <nav className="w-48 shrink-0 p-2 border-r border-overlay/10 bg-shade/10 flex flex-col gap-0.5">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                section === id
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-overlay/5"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} className={section === id ? "text-[var(--color-accent)]" : ""} />
              {label}
              {id === "activity" && newRewards && (
                <span className="ml-auto h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-label="Nouvelles récompenses" />
              )}
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
            {section === "activity" && <ActivitySection />}
            {section === "about" && <AboutSection />}
          </div>
          {!READ_ONLY.includes(section) && (
            <div className="flex justify-end px-6 py-3 border-t border-overlay/10">
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-overlay/10"
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

const THEMES: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "Système", icon: Monitor },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "light", label: "Clair", icon: Sun },
];

function AppearanceSection() {
  const theme = useDisplayStore((s) => s.theme);
  const zoom = useDisplayStore((s) => s.zoom);
  const density = useDisplayStore((s) => s.density);
  const update = useDisplayStore((s) => s.update);
  const index = Math.max(0, ZOOM_STEPS.findIndex((z) => Math.abs(z - zoom) < 1e-6));

  return (
    <>
      <SectionTitle title="Apparence" subtitle="Thème, taille et densité de l'interface." />

      <Group title="Thème" description="« Système » suit le réglage clair / sombre du système, y compris quand il change.">
        <div className="grid grid-cols-3 gap-2.5">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => update({ theme: value })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                theme === value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40"
                  : "border-overlay/10 hover:border-overlay/25 hover:bg-overlay/5"
              }`}
            >
              <Icon size={15} strokeWidth={1.75} className={theme === value ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Group>

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
                  : "border-overlay/10 hover:border-overlay/25 hover:bg-overlay/5"
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
    <svg viewBox="0 0 120 64" className="w-full h-14 rounded bg-shade/25">
      <line x1="16" y1={ys[0]} x2="16" y2={ys[2]} stroke="var(--color-accent)" strokeWidth="2" />
      {ys.map((y, i) => (
        <g key={i}>
          <circle cx="16" cy={y} r="4" fill="var(--color-bg-primary)" stroke="var(--color-accent)" strokeWidth="2" />
          <rect x="28" y={y - 2.5} width={i === 1 ? 60 : 78} height="5" rx="2.5" fill="var(--overlay)" opacity="0.18" />
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
          className="rounded-lg border border-overlay/10 bg-[var(--color-bg-primary)] px-3 py-2.5 overflow-hidden"
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
  const syncing = useSyncRunning();
  const index = Math.max(0, SYNC_INTERVALS.indexOf(interval));

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
        onClick={() => void syncOpenRepos()}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-overlay/10 hover:bg-overlay/10 disabled:opacity-50"
      >
        <RefreshCw size={13} strokeWidth={1.75} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
      </button>
      <NotificationsGroup />
    </>
  );
}

const NOTIFICATION_KINDS: { key: Exclude<keyof NotificationSettings, "enabled">; label: string }[] = [
  { key: "opened", label: "Nouvelle PR / MR à traiter (assignée ou relecture demandée)" },
  { key: "commits", label: "Nouveaux commits (hors mes propres PR / MR)" },
  { key: "comments", label: "Nouveaux commentaires" },
  { key: "ci", label: "CI passée ou en échec" },
  { key: "review", label: "Approbation ou modifications demandées" },
  { key: "badge", label: "Pastille sur l'icône : nombre de PR / MR avec du nouveau, non consultées" },
];

function NotificationsGroup() {
  const settings = useDisplayStore((s) => s.notifications);
  const update = useDisplayStore((s) => s.update);
  const notify = useUiStore((s) => s.notify);
  const set = (patch: Partial<NotificationSettings>) => update({ notifications: { ...settings, ...patch } });

  async function test() {
    try {
      if (!(await sendTestNotification())) notify("error", "Les notifications système ne sont pas autorisées pour Merathon.");
    } catch (e) {
      notify("error", `Notification impossible : ${errorMessage(e)}`);
    }
  }

  return (
    <section className="mt-6">
      <Group
        title="Notifications"
        description="À chaque synchronisation, l'activité de mes PR / MR (tous projets) : notification système si Merathon est en arrière-plan, simple bandeau sinon."
      >
        <label className="flex items-center gap-2 mb-2 font-medium">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          Activer les notifications
        </label>
        <div className={`flex flex-col gap-1.5 pl-5 ${settings.enabled ? "" : "opacity-50"}`}>
          {NOTIFICATION_KINDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings[key]}
                disabled={!settings.enabled}
                onChange={(e) => set({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </Group>
      <button
        onClick={() => void test()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-overlay/10 hover:bg-overlay/10"
      >
        <Bell size={13} strokeWidth={1.75} />
        Envoyer une notification d'essai
      </button>
    </section>
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
          <div className="rounded-lg border border-overlay/10 divide-y divide-overlay/5">
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

// ---------------------------------------------------------------- À propos

const LINKS: { label: string; icon: LucideIcon; url: (version: string) => string }[] = [
  { label: "Dépôt GitHub", icon: FolderGit2, url: () => REPO_URL },
  { label: "Notes de cette version", icon: ScrollText, url: releaseUrl },
  { label: "Journal des modifications", icon: BookOpen, url: () => `${REPO_URL}/blob/main/CHANGELOG.md` },
  { label: "Signaler un bug", icon: Bug, url: () => `${REPO_URL}/issues/new/choose` },
  { label: "Licence MIT", icon: Scale, url: () => `${REPO_URL}/blob/main/LICENSE` },
];

function AboutSection() {
  const [version, setVersion] = useState("");
  const [tauri, setTauri] = useState("");
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Hors de Tauri (tests, aperçu navigateur) : les champs restent vides.
    getVersion().then(setVersion).catch(() => {});
    getTauriVersion().then(setTauri).catch(() => {});
    appInfo().then(setInfo).catch(() => {});
  }, []);

  async function check() {
    setChecking(true);
    try {
      await checkForUpdates(true);
    } finally {
      setChecking(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(aboutReport(version, tauri, info));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rows: [string, string][] = [
    ["Version", version ? versionLabel(version, info) : "…"],
    ["Système", info ? `${osLabel(info.os)} · ${info.arch}` : "…"],
    ["Tauri", tauri || "…"],
    ["libgit2", info?.libgit2 ?? "…"],
  ];

  return (
    <>
      <div className="mb-5 flex items-center gap-4">
        <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            Merathon {version && <span className="ml-1 font-mono text-xs font-normal text-[var(--color-muted)]">v{version}</span>}
          </h2>
          <p className="mt-0.5 text-[var(--color-muted)]">Git Repository Manager — client Git graphique de bureau.</p>
        </div>
      </div>

      <Group title="Version installée" description="À joindre à un rapport de bug.">
        <div className="rounded-lg border border-overlay/10 divide-y divide-overlay/5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2">
              <span className="text-[var(--color-muted)]">{label}</span>
              <span className="font-mono text-[11px] select-text">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={check}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-overlay/10 hover:bg-overlay/10 disabled:opacity-50"
          >
            <RefreshCw size={13} strokeWidth={1.75} className={checking ? "animate-spin" : ""} />
            {checking ? "Vérification…" : "Rechercher des mises à jour"}
          </button>
          <button
            onClick={copy}
            disabled={!version}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-overlay/10 hover:bg-overlay/10 disabled:opacity-50"
          >
            {copied ? <Check size={13} strokeWidth={1.75} /> : <Copy size={13} strokeWidth={1.75} />}
            {copied ? "Copié" : "Copier les informations"}
          </button>
        </div>
      </Group>

      <Group title="Liens">
        <div className="rounded-lg border border-overlay/10 divide-y divide-overlay/5">
          {LINKS.map(({ label, icon: Icon, url }) => (
            <button
              key={label}
              onClick={() => openUrl(url(version)).catch(() => {})}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-overlay/5"
            >
              <Icon size={14} strokeWidth={1.75} className="text-[var(--color-muted)]" />
              <span className="flex-1">{label}</span>
              <ExternalLink size={12} strokeWidth={1.75} className="text-[var(--color-muted)]" />
            </button>
          ))}
        </div>
      </Group>

      <p className="text-[10px] text-[var(--color-muted)]">© 2026 Julien Dudek — distribué sous licence MIT.</p>
    </>
  );
}

// ---------------------------------------------------------------- Mon activité

const KIND_LABELS: Record<MilestoneKind, string> = { commit: "Commits", branch: "Branches", pr: "PR / MR", merge: "Fusions" };
const KIND_UNITS: Record<MilestoneKind, string> = { commit: "commits", branch: "branches", pr: "PR / MR", merge: "fusions" };

/** Couleur d'un badge selon l'ampleur du palier : accent, argent, or. */
const BADGE_STYLES: Record<Tier, string> = {
  0: "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15",
  1: "border-sky-300/70 bg-sky-300/15",
  2: "border-amber-400 bg-amber-400/20 shadow-[0_0_12px_rgb(251_191_36/0.35)]",
};

const rewardDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function ActivitySection() {
  const milestones = useCelebrationStore((s) => s.milestones);
  // Ce qui est nouveau l'est pour toute la visite : la date de dernière visite est relue à l'ouverture seulement.
  const [seenAt] = useState(() => useCelebrationStore.getState().milestones.seenAt);
  useEffect(() => () => useCelebrationStore.getState().markSeen(), []);
  const surprises = milestones.rewards.filter((r) => r.surprise);

  return (
    <>
      <SectionTitle title="Mon activité" subtitle="Vos récompenses obtenues avec Merathon. Les prochaines restent une surprise." />

      <div className="mb-6 grid grid-cols-4 gap-2.5">
        {MILESTONE_KINDS.map((kind) => (
          <div key={kind} className="rounded-lg border border-overlay/10 bg-overlay/[0.03] px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[var(--color-muted)]">
              <span className="celebrate-emoji">{kindEmojis(kind)[0]}</span>
              {KIND_LABELS[kind]}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{milestones.counts[kind]}</p>
          </div>
        ))}
      </div>

      {MILESTONE_KINDS.map((kind) => {
        const count = milestones.counts[kind];
        const next = nextMilestone(kind, count);
        const rewards = milestones.rewards.filter((r) => r.kind === kind && !r.surprise).sort((a, b) => a.count - b.count);
        return (
          <Group key={kind} title={KIND_LABELS[kind]} description={`Prochain palier : ${next} ${KIND_UNITS[kind]}`} value={`${count} / ${next}`}>
            <div className="mb-3 h-1.5 rounded-full bg-overlay/10 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, (count / next) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {rewards.map((r) => <RewardBadge key={r.count} reward={r} isNew={r.at !== null && r.at > seenAt} />)}
              <LockedBadge />
            </div>
          </Group>
        );
      })}

      {surprises.length > 0 && (
        <Group title="Surprises" description="Hors palier, un commit sur 100 en moyenne déclenche une surprise.">
          <div className="flex flex-wrap gap-2">
            {surprises.map((r) => <RewardBadge key={`${r.count}-${r.at}`} reward={r} isNew={r.at !== null && r.at > seenAt} />)}
          </div>
        </Group>
      )}
    </>
  );
}

/** Médaille d'une récompense obtenue ; la date et le libellé sont dans l'infobulle. */
function RewardBadge({ reward, isNew }: { reward: Reward; isNew: boolean }) {
  const tier = reward.surprise ? 0 : milestoneTier(reward.kind, reward.count);
  const date = reward.at === null ? "Date inconnue" : `Obtenu le ${rewardDate.format(reward.at)}`;
  return (
    <Tooltip title={rewardLabel(reward)} lines={[date]}>
      <div
        className={`relative flex h-11 min-w-11 flex-col items-center justify-center rounded-full border-2 px-1.5 ${
          reward.surprise ? "border-green-400/60 bg-green-400/15" : BADGE_STYLES[tier]
        }`}
      >
        <span className="celebrate-emoji text-sm leading-none">{reward.surprise ? "🍀" : kindEmojis(reward.kind)[0]}</span>
        <span className="text-[10px] font-semibold leading-tight tabular-nums">{reward.count}</span>
        {isNew && (
          <span className="absolute -top-2.5 -right-2.5 rounded-full bg-[var(--color-accent)] px-1 text-[8px] font-bold uppercase leading-[14px] text-white">
            nouveau
          </span>
        )}
      </div>
    </Tooltip>
  );
}

/** Prochaine médaille, cachée pour garder la surprise. */
function LockedBadge() {
  return (
    <Tooltip title="Prochaine récompense" lines={["Continuez pour la découvrir"]}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-overlay/20 text-[var(--color-muted)]">
        <span className="celebrate-emoji text-sm opacity-60">🔒</span>
      </div>
    </Tooltip>
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
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-overlay/[0.07] font-mono text-[11px] tabular-nums">{value}</span>
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
