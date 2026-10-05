import type { CommitInfo } from "../types/git";

export interface CommitNode {
  commit: CommitInfo;
  lane: number;
  row: number;
  color: string;
}

export interface GraphEdge {
  fromRow: number;
  fromLane: number;
  toRow: number;
  toLane: number;
  color: string;
  /**
   * Où se fait le changement de colonne quand fromLane !== toLane :
   * - "start" : juste sous l'enfant (une branche fusionnée part du commit de merge) ;
   * - "end"   : juste au-dessus du parent (une branche rejoint son point de départ).
   */
  curve: "start" | "end";
}

export interface GraphLayout {
  nodes: CommitNode[];
  edges: GraphEdge[];
  laneCount: number;
}

const LANE_COLORS = [
  "#7c6af7", "#36b37e", "#e94560", "#f59e0b",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316",
];

function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

interface PendingEdge {
  fromRow: number;
  fromLane: number;
  parentHash: string;
  color: string;
  curve: GraphEdge["curve"];
}

export function computeGraphLayout(commits: CommitInfo[]): GraphLayout {
  if (commits.length === 0) return { nodes: [], edges: [], laneCount: 0 };

  const hashToRow = new Map<string, number>();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  // lanes[i] = hash du commit attendu dans la colonne i (le parent d'un commit déjà placé)
  const lanes: (string | null)[] = [];
  const nodes: CommitNode[] = [];
  const pending: PendingEdge[] = [];
  let maxLanes = 0;

  const freeLane = () => {
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];

    // Colonne réservée par un enfant, sinon première colonne libre
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) lane = freeLane();

    // Plusieurs enfants peuvent attendre ce commit : leurs colonnes le rejoignent ici et se libèrent.
    for (let i = 0; i < lanes.length; i++) {
      if (i !== lane && lanes[i] === commit.hash) lanes[i] = null;
    }

    const color = laneColor(lane);
    nodes.push({ commit, lane, row, color });

    const [firstParent, ...mergeParents] = commit.parents;
    if (firstParent !== undefined && hashToRow.has(firstParent)) {
      // Le premier parent continue dans notre colonne
      lanes[lane] = firstParent;
      pending.push({ fromRow: row, fromLane: lane, parentHash: firstParent, color, curve: "end" });
    } else {
      lanes[lane] = null;
    }

    for (const parentHash of mergeParents) {
      if (!hashToRow.has(parentHash)) continue;
      if (lanes.indexOf(parentHash) === -1) lanes[freeLane()] = parentHash;
      pending.push({ fromRow: row, fromLane: lane, parentHash, color: laneColor(lanes.indexOf(parentHash)), curve: "start" });
    }

    maxLanes = Math.max(maxLanes, lanes.length);
  }

  const laneByHash = new Map(nodes.map((n) => [n.commit.hash, n.lane]));
  const edges: GraphEdge[] = pending.map((e) => ({
    fromRow: e.fromRow,
    fromLane: e.fromLane,
    toRow: hashToRow.get(e.parentHash)!,
    toLane: laneByHash.get(e.parentHash)!,
    color: e.color,
    curve: e.curve,
  }));

  return { nodes, edges, laneCount: Math.max(1, maxLanes) };
}
