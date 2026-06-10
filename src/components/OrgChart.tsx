"use client";

import { useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge as FlowEdge,
  Node as FlowNode,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

export interface ChartPerson {
  id: string;
  firstName: string;
  lastName: string;
  disposition: string;
  positions: { title: string; company: { name: string } }[];
  // degrees of connection from the current user via their LinkedIn network
  // (1 = direct connection); undefined = no known path
  degree?: number;
}

export function degreeLabel(degree: number) {
  return degree === 1 ? "1st" : degree === 2 ? "2nd" : degree === 3 ? "3rd" : `${degree}th`;
}

export interface ChartEdge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  strength: number;
}

const DISPOSITION_STYLE: Record<string, string> = {
  champion: "border-emerald-500 bg-emerald-50",
  influencer: "border-sky-500 bg-sky-50",
  economic_buyer: "border-violet-500 bg-violet-50",
  technical_buyer: "border-indigo-500 bg-indigo-50",
  blocker: "border-red-500 bg-red-50",
  neutral: "border-gray-300 bg-white",
  end_user: "border-gray-300 bg-white",
  unknown: "border-gray-300 bg-white",
};

const EDGE_COLOR: Record<string, string> = {
  REPORTS_TO: "#64748b",
  DOTTED_LINE: "#94a3b8",
  INFLUENCES: "#0ea5e9",
  ALLY_OF: "#10b981",
  CONFLICT_WITH: "#ef4444",
  FORMER_COLLEAGUE: "#a855f7",
  MENTOR_OF: "#f59e0b",
};

function PersonNode({ data }: NodeProps<{ person: ChartPerson; onSelect: (id: string) => void }>) {
  const p = data.person;
  const style = DISPOSITION_STYLE[p.disposition] ?? DISPOSITION_STYLE.unknown;
  const title = p.positions[0]?.title;
  return (
    <button
      onClick={() => data.onSelect(p.id)}
      className={`w-48 rounded-lg border-2 px-3 py-2 text-left shadow-sm hover:shadow-md ${style}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center justify-between gap-1">
        <div className="text-sm font-semibold">
          {p.firstName} {p.lastName}
        </div>
        {p.degree != null && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              p.degree === 1 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"
            }`}
            title={`${degreeLabel(p.degree)}-degree connection via your LinkedIn network`}
          >
            {degreeLabel(p.degree)}
          </span>
        )}
      </div>
      {title && <div className="truncate text-xs text-gray-600">{title}</div>}
      {p.disposition !== "unknown" && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {p.disposition.replace("_", " ")}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </button>
  );
}

const nodeTypes = { person: PersonNode };

// Layered tree layout from REPORTS_TO edges: managers above reports, multiple
// roots laid out side by side, non-hierarchy people in a bottom row.
function layout(people: ChartPerson[], edges: ChartEdge[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const reports = edges.filter((e) => e.type === "REPORTS_TO");
  const managerOf = new Map<string, string>(); // personId -> managerId
  const childrenOf = new Map<string, string[]>();
  for (const e of reports) {
    managerOf.set(e.fromId, e.toId);
    childrenOf.set(e.toId, [...(childrenOf.get(e.toId) ?? []), e.fromId]);
  }
  const ids = new Set(people.map((p) => p.id));
  const roots = people.filter((p) => !managerOf.has(p.id) && (childrenOf.get(p.id)?.length ?? 0) > 0);
  const orphans = people.filter(
    (p) => !managerOf.has(p.id) && (childrenOf.get(p.id)?.length ?? 0) === 0
  );

  const X = 220;
  const Y = 130;
  let cursor = 0;
  let maxDepth = 0;

  function place(id: string, depth: number): { left: number; right: number } {
    if (!ids.has(id)) return { left: cursor, right: cursor };
    maxDepth = Math.max(maxDepth, depth);
    const kids = (childrenOf.get(id) ?? []).filter((k) => ids.has(k));
    if (kids.length === 0) {
      const x = cursor * X;
      cursor += 1;
      pos.set(id, { x, y: depth * Y });
      return { left: x, right: x };
    }
    let left = Infinity;
    let right = -Infinity;
    for (const kid of kids) {
      const span = place(kid, depth + 1);
      left = Math.min(left, span.left);
      right = Math.max(right, span.right);
    }
    pos.set(id, { x: (left + right) / 2, y: depth * Y });
    return { left, right };
  }

  for (const root of roots) {
    place(root.id, 0);
    cursor += 1; // gap between subtrees
  }
  orphans.forEach((p, i) => {
    pos.set(p.id, { x: i * X, y: (maxDepth + 2) * Y });
  });
  return pos;
}

export function OrgChart({
  people,
  edges,
  onSelect,
}: {
  people: ChartPerson[];
  edges: ChartEdge[];
  onSelect: (personId: string) => void;
}) {
  const handleSelect = useCallback(onSelect, [onSelect]);

  const { nodes, flowEdges } = useMemo(() => {
    const positions = layout(people, edges);
    const nodes: FlowNode[] = people.map((p) => ({
      id: p.id,
      type: "person",
      position: positions.get(p.id) ?? { x: 0, y: 0 },
      data: { person: p, onSelect: handleSelect },
    }));
    const flowEdges: FlowEdge[] = edges.map((e) => ({
      id: e.id,
      // REPORTS_TO renders manager -> report top-down; others point from -> to.
      source: e.type === "REPORTS_TO" ? e.toId : e.fromId,
      target: e.type === "REPORTS_TO" ? e.fromId : e.toId,
      animated: e.type !== "REPORTS_TO" && e.type !== "DOTTED_LINE",
      label: e.type === "REPORTS_TO" ? undefined : e.type.replace(/_/g, " ").toLowerCase(),
      labelStyle: { fontSize: 9, fill: EDGE_COLOR[e.type] },
      style: {
        stroke: EDGE_COLOR[e.type] ?? "#64748b",
        strokeWidth: e.type === "REPORTS_TO" ? 1.5 : Math.max(1, e.strength / 2),
        strokeDasharray: e.type === "REPORTS_TO" ? undefined : "5 4",
      },
      markerEnd:
        e.type === "REPORTS_TO"
          ? undefined
          : { type: MarkerType.ArrowClosed, color: EDGE_COLOR[e.type] },
    }));
    return { nodes, flowEdges };
  }, [people, edges, handleSelect]);

  return (
    <div className="h-[640px] rounded-lg border border-gray-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
