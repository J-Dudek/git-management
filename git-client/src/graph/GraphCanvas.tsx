import { useEffect, useRef } from "react";
import type { GraphLayout } from "./layout";

export const ROW_HEIGHT = 28;
export const LANE_WIDTH = 16;
const NODE_RADIUS = 5;
export const H_PADDING = 10;

interface Props {
  layout: GraphLayout;
  selectedHash: string | null;
  headHash: string | null;
  onSelectRow: (row: number) => void;
  width: number;
  /** Position de défilement et hauteur visibles : seul ce qui est à l'écran est dessiné. */
  scrollTop: number;
  viewportHeight: number;
}

export function GraphCanvas({ layout, selectedHash, headHash, onSelectRow, width, scrollTop, viewportHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = Math.max(viewportHeight, 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, -scrollTop * dpr);
    ctx.clearRect(0, scrollTop, width, height);

    const x = (lane: number) => H_PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const y = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;
    const top = scrollTop - ROW_HEIGHT;
    const bottom = scrollTop + height + ROW_HEIGHT;

    for (const edge of layout.edges) {
      const y1 = y(edge.fromRow);
      const y2 = y(edge.toRow);
      if (y2 < top || y1 > bottom) continue;
      const x1 = x(edge.fromLane);
      const x2 = x(edge.toLane);

      ctx.beginPath();
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(x1, y1);
      if (x1 === x2) {
        ctx.lineTo(x2, y2);
      } else if (edge.curve === "start") {
        // Quitte l'enfant en courbe vers la colonne du parent, puis descend.
        const yCurve = Math.min(y1 + ROW_HEIGHT, y2);
        ctx.bezierCurveTo(x1, (y1 + yCurve) / 2, x2, (y1 + yCurve) / 2, x2, yCurve);
        ctx.lineTo(x2, y2);
      } else {
        // Descend dans la colonne de l'enfant, puis rejoint le parent en courbe.
        const yCurve = Math.max(y2 - ROW_HEIGHT, y1);
        ctx.lineTo(x1, yCurve);
        ctx.bezierCurveTo(x1, (yCurve + y2) / 2, x2, (yCurve + y2) / 2, x2, y2);
      }
      ctx.stroke();
    }

    const firstRow = Math.max(0, Math.floor(top / ROW_HEIGHT));
    const lastRow = Math.min(layout.nodes.length - 1, Math.ceil(bottom / ROW_HEIGHT));
    for (let row = firstRow; row <= lastRow; row++) {
      const node = layout.nodes[row];
      const nx = x(node.lane);
      const ny = y(node.row);
      const isSelected = node.commit.hash === selectedHash;
      const isHead = node.commit.hash === headHash;
      const isMerge = node.commit.parents.length > 1;

      ctx.beginPath();
      ctx.arc(nx, ny, isSelected || isHead ? NODE_RADIUS + 1.5 : isMerge ? NODE_RADIUS - 1.5 : NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ffffff" : isHead ? "#1a1b26" : node.color;
      ctx.fill();
      if (isSelected || isHead) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }, [layout, selectedHash, headHash, width, height, scrollTop]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top + scrollTop) / ROW_HEIGHT);
    if (row >= 0 && row < layout.nodes.length) {
      onSelectRow(row);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, position: "sticky", top: 0, left: 0, display: "block" }}
      onClick={handleClick}
      className="cursor-pointer"
    />
  );
}
