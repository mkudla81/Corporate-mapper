"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
import type { OrgNode, OrgBridge } from "@/lib/network";

function OrgNodeCard({ data }: NodeProps<{ org: OrgNode; onOpen: (mapId: string) => void }>) {
  const org = data.org;
  return (
    <button
      onClick={() => data.onOpen(org.mapIds[0])}
      className="w-56 rounded-xl border-2 border-brand-500 bg-white px-4 py-3 text-left shadow-md hover:shadow-lg"
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="text-sm font-bold text-brand-700">🏢 {org.name}</div>
      <div className="mt-1 text-xs text-gray-600">
        {org.peopleCount} mapped {org.peopleCount === 1 ? "person" : "people"}
      </div>
      {org.yourContacts.length > 0 && (
        <div className="mt-1.5 rounded bg-emerald-50 px-1.5 py-1 text-[10px] text-emerald-800">
          ✓ You know {org.yourContacts.slice(0, 2).join(", ")}
          {org.yourContacts.length > 2 ? ` +${org.yourContacts.length - 2} more` : ""}
        </div>
      )}
      <div className="mt-1 text-[10px] text-gray-400">{org.mapNames.join(" · ")}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </button>
  );
}

function YouNode() {
  return (
    <div className="rounded-full border-2 border-emerald-600 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800 shadow-md">
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
      🧑 You
    </div>
  );
}

const nodeTypes = { org: OrgNodeCard, you: YouNode };

export function OrgNetwork({ orgs, bridges }: { orgs: OrgNode[]; bridges: OrgBridge[] }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    // Orgs on a circle, "You" in the center.
    const R = Math.max(280, orgs.length * 70);
    const nodes: FlowNode[] = orgs.map((org, i) => {
      const angle = (2 * Math.PI * i) / Math.max(orgs.length, 1) - Math.PI / 2;
      return {
        id: org.key,
        type: "org",
        position: { x: R * Math.cos(angle), y: R * Math.sin(angle) },
        data: { org, onOpen: (mapId: string) => router.push(`/maps/${mapId}`) },
      };
    });
    nodes.push({ id: "__you__", type: "you", position: { x: -30, y: -20 }, data: {} });

    const edges: FlowEdge[] = bridges.map((b, i) => ({
      id: `bridge-${i}`,
      source: b.fromKey,
      target: b.toKey,
      label: b.label,
      labelStyle: { fontSize: 10 },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.85 },
      animated: b.kind === "relationship",
      style: {
        stroke: b.kind === "work_history" ? "#a855f7" : "#0ea5e9",
        strokeWidth: 1.5,
        strokeDasharray: b.kind === "work_history" ? "6 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

    for (const org of orgs) {
      if (org.yourContacts.length > 0) {
        edges.push({
          id: `you-${org.key}`,
          source: "__you__",
          target: org.key,
          label: `${org.yourContacts.length} connection${org.yourContacts.length === 1 ? "" : "s"}`,
          labelStyle: { fontSize: 10, fill: "#059669" },
          labelBgStyle: { fill: "#fff", fillOpacity: 0.85 },
          style: { stroke: "#10b981", strokeWidth: 2 },
        });
      }
    }
    return { nodes, edges };
  }, [orgs, bridges, router]);

  return (
    <div className="h-[680px] rounded-lg border border-gray-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
      >
        <Background gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
