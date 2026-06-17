import { useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { SearchBar } from "./components/SearchBar";
import { Sidebar } from "./components/Sidebar";
import { AccountsPanel } from "./components/AccountsPanel";
import { CommitGraph } from "./graph/CommitGraph";
import { StagingPanel } from "./components/StagingPanel";

type LeftTab = "branches" | "github";

export default function App() {
  const [leftTab, setLeftTab] = useState<LeftTab>("branches");

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <div className="flex items-center gap-3 pr-3">
        <div className="flex-1">
          <Toolbar />
        </div>
        <SearchBar />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-52 shrink-0 flex flex-col overflow-hidden border-r border-white/10">
          <div className="flex shrink-0 border-b border-white/10">
            <LeftTabBtn active={leftTab === "branches"} onClick={() => setLeftTab("branches")}>Branches</LeftTabBtn>
            <LeftTabBtn active={leftTab === "github"} onClick={() => setLeftTab("github")}>Comptes</LeftTabBtn>
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === "branches" ? <Sidebar /> : <AccountsPanel />}
          </div>
        </div>

        {/* Graph */}
        <main className="flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
          <CommitGraph />
        </main>

        {/* Right panel */}
        <div className="w-64 shrink-0 overflow-hidden">
          <StagingPanel />
        </div>
      </div>
    </div>
  );
}

function LeftTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-1.5 transition-colors ${
        active
          ? "text-[var(--color-text)] border-b-2 border-[var(--color-accent)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-text)] border-b-2 border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
