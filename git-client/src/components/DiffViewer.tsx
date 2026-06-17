import type { FileDiff, DiffLine } from "../types/git";

interface Props {
  diff: FileDiff | null;
  loading: boolean;
}

export function DiffViewer({ diff, loading }: Props) {
  if (loading) {
    return <div className="p-3 text-xs text-[var(--color-muted)] animate-pulse">Chargement…</div>;
  }
  if (!diff) {
    return <div className="p-3 text-xs text-[var(--color-muted)] italic">Sélectionne un fichier</div>;
  }
  if (diff.is_binary) {
    return <div className="p-3 text-xs text-[var(--color-muted)] italic">Fichier binaire</div>;
  }
  if (diff.hunks.length === 0) {
    return <div className="p-3 text-xs text-[var(--color-muted)] italic">Aucune différence</div>;
  }

  return (
    <div className="overflow-auto h-full font-mono text-[11px] leading-5">
      {diff.hunks.map((hunk, i) => (
        <div key={i}>
          <div className="px-2 py-0.5 bg-[#1e2a3a] text-[#5b8dd9] border-y border-white/5 sticky top-0">
            {hunk.header}
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {hunk.lines.map((line, j) => (
                <DiffLineRow key={j} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const { bg, text, prefix } = lineStyle(line.kind);

  return (
    <tr className={bg}>
      <td className="w-10 text-right pr-2 select-none text-[var(--color-muted)] opacity-50 border-r border-white/5">
        {line.old_lineno ?? ""}
      </td>
      <td className="w-10 text-right pr-2 select-none text-[var(--color-muted)] opacity-50 border-r border-white/5">
        {line.new_lineno ?? ""}
      </td>
      <td className={`pl-2 pr-4 whitespace-pre ${text}`}>
        <span className="select-none mr-1 opacity-70">{prefix}</span>
        {line.content}
      </td>
    </tr>
  );
}

function lineStyle(kind: DiffLine["kind"]) {
  switch (kind) {
    case "added":   return { bg: "bg-green-950/40",  text: "text-green-300",  prefix: "+" };
    case "removed": return { bg: "bg-red-950/40",    text: "text-red-300",    prefix: "-" };
    default:        return { bg: "",                  text: "text-[var(--color-text)]", prefix: " " };
  }
}
