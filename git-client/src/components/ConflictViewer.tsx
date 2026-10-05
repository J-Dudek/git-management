import { useState, useEffect } from "react";
import { useRepoStore } from "../store/useRepoStore";
import { useUiStore } from "../store/useUiStore";
import { getConflictContent, resolveConflict } from "../ipc/commands";
import { errorMessage } from "../lib/actions";

interface ConflictSection {
  ours: string[];
  theirs: string[];
  before: string[];
}

export function parseConflicts(content: string): ConflictSection[] {
  const sections: ConflictSection[] = [];
  const lines = content.split("\n");
  let state: "normal" | "ours" | "theirs" = "normal";
  let current: ConflictSection = { ours: [], theirs: [], before: [] };
  let context: string[] = [];

  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      current = { ours: [], theirs: [], before: context.slice(-3) };
      context = [];
      state = "ours";
    } else if (line.startsWith("=======") && state === "ours") {
      state = "theirs";
    } else if (line.startsWith(">>>>>>>") && state === "theirs") {
      sections.push(current);
      current = { ours: [], theirs: [], before: [] };
      state = "normal";
    } else if (state === "ours") {
      current.ours.push(line);
    } else if (state === "theirs") {
      current.theirs.push(line);
    } else {
      context.push(line);
    }
  }

  return sections;
}

export function resolveWith(content: string, choices: ("ours" | "theirs" | "both")[]): string {
  const result: string[] = [];
  let state: "normal" | "ours" | "theirs" = "normal";
  let conflictIdx = 0;
  let ours: string[] = [];
  let theirs: string[] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith("<<<<<<<") && state === "normal") {
      ours = [];
      theirs = [];
      state = "ours";
    } else if (line.startsWith("=======") && state === "ours") {
      state = "theirs";
    } else if (line.startsWith(">>>>>>>") && state === "theirs") {
      const choice = choices[conflictIdx] ?? "ours";
      if (choice === "ours" || choice === "both") result.push(...ours);
      if (choice === "theirs" || choice === "both") result.push(...theirs);
      state = "normal";
      conflictIdx++;
    } else if (state === "ours") {
      ours.push(line);
    } else if (state === "theirs") {
      theirs.push(line);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

export function ConflictViewer({ path }: { path: string }) {
  const repoPath = useRepoStore((s) => s.repoPath);
  const refresh = useRepoStore((s) => s.refresh);
  const setCenter = useRepoStore((s) => s.setCenter);
  const notify = useUiStore((s) => s.notify);
  const [content, setContent] = useState<string | null>(null);
  const [sections, setSections] = useState<ConflictSection[]>([]);
  const [choices, setChoices] = useState<("ours" | "theirs" | "both")[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setContent(null);
    setError(null);
    getConflictContent(repoPath, path)
      .then((c) => {
        setContent(c);
        const s = parseConflicts(c);
        setSections(s);
        setChoices(s.map(() => "ours"));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [repoPath, path]);

  async function handleResolve() {
    if (!repoPath || content === null) return;
    setSaving(true);
    try {
      await resolveConflict(repoPath, path, resolveWith(content, choices));
      notify("success", `${path} résolu et indexé`);
      setCenter({ kind: "graph" });
      await refresh();
    } catch (e) {
      notify("error", errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <div className="p-3 text-xs text-red-400 break-words">{error}</div>;
  }
  if (content === null) {
    return <div className="p-3 text-xs text-[var(--color-muted)] animate-pulse">Chargement du conflit…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-3 h-9 border-b border-white/10 shrink-0 bg-[var(--color-bg-secondary)]">
        <button
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          onClick={() => setCenter({ kind: "graph" })}
        >
          ← Graphe
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">⚠ Conflit</span>
        <span className="text-xs font-mono text-[var(--color-text)] truncate flex-1">{path}</span>
        <span className="text-[11px] text-[var(--color-muted)]">
          {sections.length} bloc{sections.length > 1 ? "s" : ""} — clique sur la version à garder
        </span>
        <button
          className="text-xs px-3 py-1 rounded bg-green-700/70 hover:bg-green-700 text-white disabled:opacity-40"
          onClick={handleResolve}
          disabled={saving}
        >
          {saving ? "Résolution…" : sections.length ? "Résoudre et indexer" : "Marquer comme résolu"}
        </button>
      </div>

      {sections.length === 0 && (
        <p className="p-3 text-xs text-[var(--color-muted)]">
          Aucun marqueur de conflit dans ce fichier (déjà édité, ou conflit de suppression). Tu peux le marquer comme résolu.
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sections.map((section, i) => (
          <div key={i} className="border border-white/10 rounded overflow-hidden text-[11px] font-mono">
            {section.before.length > 0 && (
              <div className="px-3 py-1 bg-black/20 text-[var(--color-muted)] opacity-60">
                {section.before.map((l, j) => <div key={j} className="whitespace-pre">{l || " "}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <SidePanel
                label="Actuel (HEAD)"
                lines={section.ours}
                chosen={choices[i]}
                side="ours"
                onChoose={(c) => setChoices((prev) => prev.map((v, j) => (j === i ? c : v)))}
                bg="bg-green-950/30"
                activeBg="bg-green-900/40"
              />
              <SidePanel
                label="Entrant"
                lines={section.theirs}
                chosen={choices[i]}
                side="theirs"
                onChoose={(c) => setChoices((prev) => prev.map((v, j) => (j === i ? c : v)))}
                bg="bg-blue-950/30"
                activeBg="bg-blue-900/40"
              />
            </div>
            <div className="flex justify-center gap-2 p-1 bg-black/20 border-t border-white/10">
              <ChoiceBtn active={choices[i] === "both"} onClick={() => setChoices((p) => p.map((v, j) => j === i ? "both" : v))}>
                Garder les deux
              </ChoiceBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SidePanel({ label, lines, chosen, side, onChoose, bg, activeBg }: {
  label: string; lines: string[]; chosen: string; side: "ours" | "theirs";
  onChoose: (c: "ours" | "theirs" | "both") => void; bg: string; activeBg: string;
}) {
  const active = chosen === side || chosen === "both";
  return (
    <div
      className={`${active ? activeBg : bg} cursor-pointer hover:opacity-90 transition-colors`}
      onClick={() => onChoose(side)}
    >
      <div className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${active ? "text-white" : "text-[var(--color-muted)]"}`}>
        {active && <span>✓</span>}
        {label}
      </div>
      <div className="px-2 py-1">
        {lines.map((l, i) => <div key={i} className={`whitespace-pre ${active ? "text-white" : "text-[var(--color-muted)]"}`}>{l || " "}</div>)}
      </div>
    </div>
  );
}

function ChoiceBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[9px] px-2 py-0.5 rounded transition-colors ${active ? "bg-white/20 text-white" : "text-[var(--color-muted)] hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}
