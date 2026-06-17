import { useEffect, useRef } from "react";
import type { GraphLayout } from "./layout";

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const NODE_RADIUS = 5;
const H_PADDING = 10;

interface Props {
  layout: GraphLayout;
  selectedHash: string | null;
  onSelectRow: (row: number) => void;
  width: number;
}

export function GraphCanvas({ layout, selectedHash, onSelectRow, width }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = Math.max(layout.nodes.length * ROW_HEIGHT, 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const x = (lane: number) => H_PADDING + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const y = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

    // Draw edges
    for (const edge of layout.edges) {
      ctx.beginPath();
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = 1.5;
      const x1 = x(edge.fromLane);
      const y1 = y(edge.fromRow);
      const x2 = x(edge.toLane);
      const y2 = y(edge.toRow);

      ctx.moveTo(x1, y1);
      if (x1 === x2) {
        ctx.lineTo(x2, y2);
      } else {
        // Bezier curve for merges/branches
        const mid = (y1 + y2) / 2;
        ctx.bezierCurveTo(x1, mid, x2, mid, x2, y2);
      }
      ctx.stroke();
    }

    // Draw nodes
    for (const node of layout.nodes) {
      const nx = x(node.lane);
      const ny = y(node.row);
      const isSelected = node.commit.hash === selectedHash;

      ctx.beginPath();
      ctx.arc(nx, ny, isSelected ? NODE_RADIUS + 2 : NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ffffff" : node.color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [layout, selectedHash, width, height]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const row = Math.floor(clickY / ROW_HEIGHT);
    if (row >= 0 && row < layout.nodes.length) {
      onSelectRow(row);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      onClick={handleClick}
      className="cursor-pointer"
    />
  );
}
