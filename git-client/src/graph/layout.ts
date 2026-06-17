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

export function computeGraphLayout(commits: CommitInfo[]): GraphLayout {
  if (commits.length === 0) return { nodes: [], edges: [], laneCount: 0 };

  const hashToRow = new Map<string, number>();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  // lanes[i] = hash of commit currently "claiming" lane i (waiting for its parent)
  const lanes: (string | null)[] = [];
  const nodes: CommitNode[] = [];
  const edges: GraphEdge[] = [];

  for (let row = 0; row < commits.length; row++) {
    const commit = commits[row];

    // Find existing lane for this commit (a child already reserved it)
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) {
      // No child reserved a lane — find first free lane
      lane = lanes.indexOf(null);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(null);
      }
    }

    const color = laneColor(lane);
    nodes.push({ commit, lane, row, color });

    // Reserve lanes for parents
    if (commit.parents.length === 0) {
      lanes[lane] = null;
    } else {
      // First parent continues in our lane
      const firstParentRow = hashToRow.get(commit.parents[0]);
      if (firstParentRow !== undefined) {
        lanes[lane] = commit.parents[0];
        edges.push({ fromRow: row, fromLane: lane, toRow: firstParentRow, toLane: lane, color });
      } else {
        lanes[lane] = null;
      }

      // Merge parents get new lanes
      for (let p = 1; p < commit.parents.length; p++) {
        const parentHash = commit.parents[p];
        const parentRow = hashToRow.get(parentHash);
        if (parentRow === undefined) continue;

        // Check if parent already has a lane
        const existingLane = lanes.indexOf(parentHash);
        if (existingLane !== -1) {
          edges.push({ fromRow: row, fromLane: lane, toRow: parentRow, toLane: existingLane, color });
        } else {
          const newLane = lanes.indexOf(null);
          const assignedLane = newLane === -1 ? lanes.length : newLane;
          if (newLane === -1) lanes.push(parentHash);
          else lanes[newLane] = parentHash;
          edges.push({ fromRow: row, fromLane: lane, toRow: parentRow, toLane: assignedLane, color });
        }
      }
    }
  }

  const laneCount = Math.max(1, lanes.length);
  return { nodes, edges, laneCount };
}
