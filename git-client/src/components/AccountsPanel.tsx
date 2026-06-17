import { useState } from "react";
import { useAccountsStore } from "../store/useAccountsStore";
import { GitHubClient } from "../api/github";
import { GitLabClient } from "../api/gitlab";
import type { ForgeAccount } from "../types/forge";
import type { ForgePR, ForgeIssue } from "../types/forge";

export function AccountsPanel() {
  const { accounts, data, activeId, addAccount, removeAccount, setData, setActive } = useAccountsStore();
  const [showForm, setShowForm] = useState(false);

  const activeAccount = accounts.find((a) => a.id === activeId) ?? null;
  const activeData = activeId ? data[activeId] : null;

  async function refresh(account: ForgeAccount) {
    setData(account.id, { loading: true, error: null });
    try {
      let prs: ForgePR[];
      let issues: ForgeIssue[];

      if (account.provider === "github") {
        const client = new GitHubClient(account.token);
        [prs, issues] = await Promise.all([
          client.getPullRequests(account.owner!, account.repo!),
          client.getIssues(account.owner!, account.repo!),
        ]);
      } else {
        const client = new GitLabClient(account.token, account.baseUrl);
        [prs, issues] = await Promise.all([
          client.getMergeRequests(account.project!),
          client.getIssues(account.project!),
        ]);
      }

      setData(account.id, { prs, issues, loading: false, error: null });
    } catch (e) {
      setData(account.id, { loading: false, error: String(e) });
    }
  }

  async function handleAdd(account: ForgeAccount) {
    addAccount(account);
    setShowForm(false);
    await refresh(account);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Account switcher */}
      <div className="flex items-center gap-1 p-1.5 border-b border-white/10 flex-wrap">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => setActive(a.id)}
            className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
              a.id === activeId ? "bg-white/15 text-[var(--color-text)]" : "text-[var(--color-muted)] hover:bg-white/10"
            }`}
          >
            <ProviderIcon provider={a.provider} />
            {a.label}
          </button>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="text-[10px] px-2 py-0.5 rounded text-[var(--color-muted)] hover:bg-white/10 ml-auto"
          title="Ajouter un compte"
        >
          + Compte
        </button>
      </div>

      {/* Add account form */}
      {showForm && (
        <AddAccountForm
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Active account content */}
      {!showForm && activeAccount && activeData && (
        <AccountContent
          account={activeAccount}
          data={activeData}
          onRefresh={() => refresh(activeAccount)}
          onRemove={() => removeAccount(activeAccount.id)}
        />
      )}

      {!showForm && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4 text-center">
          <p className="text-xs text-[var(--color-muted)]">Aucun compte configuré</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-[var(--color-text)]"
          >
            + Ajouter un compte
          </button>
        </div>
      )}
    </div>
  );
}

function AccountContent({ account, data, onRefresh, onRemove }: {
  account: ForgeAccount;
  data: ReturnType<typeof useAccountsStore.getState>["data"][string];
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<"pr" | "issues">("pr");

  const prLabel = account.provider === "gitlab" ? "MRs" : "PRs";
  const prCount = data.prs.length;
  const issueCount = data.issues.length;

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10">
        <TabBtn active={tab === "pr"} onClick={() => setTab("pr")}>{prLabel} ({prCount})</TabBtn>
        <TabBtn active={tab === "issues"} onClick={() => setTab("issues")}>Issues ({issueCount})</TabBtn>
        <div className="ml-auto flex gap-1">
          <IconBtn onClick={onRefresh} title="Rafraîchir" disabled={data.loading}>↻</IconBtn>
          <IconBtn onClick={onRemove} title="Supprimer ce compte">✕</IconBtn>
        </div>
      </div>

      {data.loading && <p className="p-3 text-xs text-[var(--color-muted)] animate-pulse">Chargement…</p>}
      {data.error && <p className="p-3 text-xs text-red-400 break-words">{data.error}</p>}

      {!data.loading && !data.error && (
        <div className="flex-1 overflow-y-auto">
          {tab === "pr" && (
            <>
              {data.prs.map((pr) => <PRRow key={pr.number} pr={pr} provider={account.provider} />)}
              {data.prs.length === 0 && <Empty text={`Aucun ${prLabel} ouvert`} />}
            </>
          )}
          {tab === "issues" && (
            <>
              {data.issues.map((issue) => <IssueRow key={issue.number} issue={issue} />)}
              {data.issues.length === 0 && <Empty text="Aucune issue ouverte" />}
            </>
          )}
        </div>
      )}
    </>
  );
}

function AddAccountForm({ onAdd, onCancel }: { onAdd: (a: ForgeAccount) => void; onCancel: () => void }) {
  const [provider, setProvider] = useState<"github" | "gitlab">("github");
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://gitlab.com");
  const [project, setProject] = useState("");

  function handleSubmit() {
    const isValid = provider === "github"
      ? token && owner && repo
      : token && project;
    if (!isValid) return;

    const account: ForgeAccount = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      provider,
      label: label || (provider === "github" ? `${owner}/${repo}` : project),
      token,
      ...(provider === "github" ? { owner, repo } : { baseUrl, project }),
    };
    onAdd(account);
  }

  return (
    <div className="p-3 flex flex-col gap-2 border-b border-white/10 bg-black/20">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Nouveau compte</p>

      <div className="flex gap-1">
        {(["github", "gitlab"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`flex-1 text-[10px] py-1 rounded flex items-center justify-center gap-1 transition-colors ${
              provider === p ? "bg-white/15 text-[var(--color-text)]" : "text-[var(--color-muted)] hover:bg-white/10"
            }`}
          >
            <ProviderIcon provider={p} />
            {p === "github" ? "GitHub" : "GitLab"}
          </button>
        ))}
      </div>

      <input className={inp} placeholder="Nom (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input className={inp} type="password" placeholder="Personal Access Token" value={token} onChange={(e) => setToken(e.target.value)} />

      {provider === "github" ? (
        <>
          <input className={inp} placeholder="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <input className={inp} placeholder="repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
        </>
      ) : (
        <>
          <input className={inp} placeholder="URL GitLab (ex: https://gitlab.myco.com)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <input className={inp} placeholder="namespace/projet ou ID numérique" value={project} onChange={(e) => setProject(e.target.value)} />
        </>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-40 text-white text-xs font-semibold py-1.5 rounded"
          onClick={handleSubmit}
          disabled={provider === "github" ? !token || !owner || !repo : !token || !project}
        >
          Connecter
        </button>
        <button className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[var(--color-muted)]" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function PRRow({ pr, provider }: { pr: ForgePR; provider: "github" | "gitlab" }) {
  const stateColor = pr.state === "open" ? "text-green-400" : pr.state === "merged" ? "text-purple-400" : "text-red-400";
  const stateIcon = pr.state === "open" ? "●" : pr.state === "merged" ? "⎇" : "✕";
  const typeLabel = provider === "gitlab" ? "MR" : "PR";

  return (
    <div className="px-3 py-2 border-b border-white/5 hover:bg-white/5">
      <div className="flex items-start gap-2">
        <span className={`${stateColor} shrink-0 mt-0.5 text-xs`}>{stateIcon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text)] truncate">{pr.title}</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
            {typeLabel}#{pr.number} · {pr.author} · {pr.sourceBranch} → {pr.targetBranch}
          </p>
          {pr.labels.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {pr.labels.map((l) => (
                <span key={l} className="px-1 text-[9px] rounded bg-white/10 text-[var(--color-muted)]">{l}</span>
              ))}
            </div>
          )}
        </div>
        {pr.draft && <span className="text-[9px] border border-white/20 px-1 rounded text-[var(--color-muted)] shrink-0">draft</span>}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: ForgeIssue }) {
  return (
    <div className="px-3 py-2 border-b border-white/5 hover:bg-white/5">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 text-xs ${issue.state === "open" ? "text-green-400" : "text-red-400"}`}>●</span>
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text)] truncate">{issue.title}</p>
          <p className="text-[10px] text-[var(--color-muted)] mt-0.5">#{issue.number} · {issue.author}</p>
        </div>
      </div>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: "github" | "gitlab" }) {
  return <span className="text-[10px]">{provider === "github" ? "⌥" : "◈"}</span>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`text-[10px] px-2 py-0.5 rounded transition-colors ${active ? "bg-white/10 text-[var(--color-text)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}>
      {children}
    </button>
  );
}

function IconBtn({ onClick, title, disabled, children }: { onClick: () => void; title?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-40 px-1">
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-3 text-xs text-[var(--color-muted)] italic">{text}</p>;
}

const inp = "bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]/50 placeholder:text-[var(--color-muted)] w-full";
