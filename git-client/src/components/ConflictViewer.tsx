import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useRepoStore } from "../store/useRepoStore";
import { getStatus } from "../ipc/commands";
import type { FileStatus } from "../types/git";

interface ConflictSection {
  ours: string[];
  theirs: string[];
  before: string[];
}

function parseConflicts(content: string): ConflictSection[] {
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

function resolveWith(content: string, choices: ("ours" | "theirs" | "both")[]): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let state: "normal" | "ours" | "theirs" = "normal";
  let conflictIdx = 0;
  let oursLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      oursLines = [];
      state = "ours";
    } else if (line.startsWith("=======") && state === "ours") {
      state = "theirs";
    } else if (line.startsWith(">>>>>>>") && state === "theirs") {
      const choice = choices[conflictIdx] ?? "ours";
      if (choice === "ours" || choice === "both") result.push(...oursLines);
      state = "normal";
      conflictIdx++;
    } else if (state === "ours") {
      oursLines.push(line);
      if (choices[conflictIdx] === "ours" || choices[conflictIdx] === "both") {
        // collected above
      }
    } else if (state === "theirs") {
      if (choices[conflictIdx] === "theirs" || choices[conflictIdx] === "both") {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

interface Props {
  file: FileStatus;
  onResolved: () => void;
}

export function ConflictViewer({ file, onResolved }: Props) {
  const repoPath = useRepoStore((s) => s.repoPath);
  const setStatus = useRepoStore((s) => s.setStatus);
  const [content, setContent] = useState<string | null>(null);
  const [sections, setSections] = useState<ConflictSection[]>([]);
  const [choices, setChoices] = useState<("ours" | "theirs" | "both")[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!repoPath) return;
    invoke<string>("get_conflict_content_cmd", { path: repoPath, filePath: file.path }).then((c) => {
      setContent(c);
      const s = parseConflicts(c);
      setSections(s);
      setChoices(s.map(() => "ours"));
    });
  }, [repoPath, file.path]);

  async function handleResolve() {
    if (!repoPath || !content) return;
    setSaving(true);
    try {
      const resolved = resolveWith(content, choices);
      await invoke("resolve_conflict_cmd", { path: repoPath, filePath: file.path, content: resolved });
      const s = await getStatus(repoPath);
      setStatus(s);
      onResolved();
    } finally {
      setSaving(false);
    }
  }

  if (!content) {
    return <div className="p-3 text-xs text-[var(--color-muted)] animate-pulse">Chargement du conflit…</div>;
  }

  const allChosen = choices.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">⚠ Conflit</span>
        <span className="text-[10px] font-mono text-[var(--color-muted)] truncate flex-1">{file.path}</span>
        <button
          className="text-xs px-2 py-0.5 rounded bg-green-700/60 hover:bg-green-700/80 text-white disabled:opacity-40"
          onClick={handleResolve}
          disabled={saving || !allChosen}
        >
          {saving ? "Résolution…" : "Résoudre"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {sections.map((section, i) => (
          <div key={i} className="border border-white/10 rounded overflow-hidden text-[11px] font-mono">
            {section.before.length > 0 && (
              <div className="px-3 py-1 bg-black/20 text-[var(--color-muted)] opacity-60">
                {section.before.map((l, j) => <div key={j}>{l}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <SidePanel
                label="HEAD (le nôtre)"
                lines={section.ours}
                chosen={choices[i]}
                side="ours"
                onChoose={(c) => setChoices((prev) => prev.map((v, j) => (j === i ? c : v)))}
                bg="bg-green-950/30"
                activeBg="bg-green-900/40"
              />
              <SidePanel
                label="Entrant (le leur)"
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
                Les deux
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
        {lines.map((l, i) => <div key={i} className={active ? "text-white" : "text-[var(--color-muted)]"}>{l || " "}</div>)}
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
