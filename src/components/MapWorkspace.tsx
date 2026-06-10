"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrgChart, ChartPerson, ChartEdge } from "./OrgChart";

interface Company {
  id: string;
  name: string;
}

interface Hint {
  id: string;
  provider: string;
  kind: string;
  payload: string;
}

interface Connection {
  id: string;
  provider: string;
  label: string;
}

const EDGE_TYPES = [
  "REPORTS_TO",
  "DOTTED_LINE",
  "INFLUENCES",
  "ALLY_OF",
  "CONFLICT_WITH",
  "FORMER_COLLEAGUE",
  "MENTOR_OF",
];

const DISPOSITIONS = [
  "unknown",
  "champion",
  "influencer",
  "economic_buyer",
  "technical_buyer",
  "end_user",
  "neutral",
  "blocker",
];

export function MapWorkspace({
  orgMapId,
  people,
  edges,
  companies,
  hints,
  connections,
}: {
  orgMapId: string;
  people: ChartPerson[];
  edges: ChartEdge[];
  companies: Company[];
  hints: Hint[];
  connections: Connection[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<"none" | "person" | "edge" | "sync">("none");
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Request failed (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
      <div className="xl:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => setPanel(panel === "person" ? "none" : "person")}>
            + Person
          </button>
          <button className="btn-secondary" onClick={() => setPanel(panel === "edge" ? "none" : "edge")}>
            + Relationship
          </button>
          <button className="btn-secondary" onClick={() => setPanel(panel === "sync" ? "none" : "sync")}>
            ⟳ Sync from CRM
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {panel === "person" && (
          <AddPersonForm
            orgMapId={orgMapId}
            companies={companies}
            people={people}
            onSubmit={async (body) => (await post("/api/people", body)) && setPanel("none")}
          />
        )}
        {panel === "edge" && (
          <AddEdgeForm
            orgMapId={orgMapId}
            people={people}
            onSubmit={async (body) => (await post("/api/edges", body)) && setPanel("none")}
          />
        )}
        {panel === "sync" && (
          <SyncForm
            orgMapId={orgMapId}
            connections={connections}
            onSubmit={async (body) => (await post("/api/integrations/sync", body)) && setPanel("none")}
          />
        )}

        <OrgChart people={people} edges={edges} onSelect={(id) => router.push(`/people/${id}`)} />
        <p className="mt-2 text-xs text-gray-500">
          Click a person to open their profile. Solid lines are reporting structure; dashed colored
          lines are the influence map.
        </p>
      </div>

      <aside className="space-y-4">
        <HintsPanel hints={hints} onResolved={() => router.refresh()} />
      </aside>
    </div>
  );
}

function AddPersonForm({
  orgMapId,
  companies,
  people,
  onSubmit,
}: {
  orgMapId: string;
  companies: Company[];
  people: ChartPerson[];
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    companyId: companies[0]?.id ?? "",
    managerId: "",
    disposition: "unknown",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form
      className="card mb-3 grid grid-cols-2 gap-3 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          orgMapId,
          ...form,
          email: form.email || undefined,
          companyId: form.companyId || undefined,
          title: form.title || undefined,
          managerId: form.managerId || undefined,
        });
      }}
    >
      <div>
        <label className="label">First name</label>
        <input className="input" value={form.firstName} onChange={set("firstName")} required />
      </div>
      <div>
        <label className="label">Last name</label>
        <input className="input" value={form.lastName} onChange={set("lastName")} required />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set("email")} />
      </div>
      <div>
        <label className="label">Title</label>
        <input className="input" value={form.title} onChange={set("title")} placeholder="VP Engineering" />
      </div>
      <div>
        <label className="label">Company</label>
        <select className="input" value={form.companyId} onChange={set("companyId")}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Reports to</label>
        <select className="input" value={form.managerId} onChange={set("managerId")}>
          <option value="">— none —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Disposition</label>
        <select className="input" value={form.disposition} onChange={set("disposition")}>
          {DISPOSITIONS.map((d) => (
            <option key={d} value={d}>
              {d.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">
          Add person
        </button>
      </div>
    </form>
  );
}

function AddEdgeForm({
  orgMapId,
  people,
  onSubmit,
}: {
  orgMapId: string;
  people: ChartPerson[];
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    fromId: people[0]?.id ?? "",
    toId: people[1]?.id ?? "",
    type: "REPORTS_TO",
    strength: 3,
    notes: "",
  });

  return (
    <form
      className="card mb-3 grid grid-cols-2 gap-3 md:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ orgMapId, ...form, strength: Number(form.strength), notes: form.notes || undefined });
      }}
    >
      <div>
        <label className="label">From</label>
        <select className="input" value={form.fromId} onChange={(e) => setForm({ ...form, fromId: e.target.value })}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Relationship</label>
        <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {EDGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">To</label>
        <select className="input" value={form.toId} onChange={(e) => setForm({ ...form, toId: e.target.value })}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Strength (1–5)</label>
        <input
          className="input"
          type="number"
          min={1}
          max={5}
          value={form.strength}
          onChange={(e) => setForm({ ...form, strength: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full">
          Link
        </button>
      </div>
    </form>
  );
}

function SyncForm({
  orgMapId,
  connections,
  onSubmit,
}: {
  orgMapId: string;
  connections: Connection[];
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [accountQuery, setAccountQuery] = useState("");

  if (connections.length === 0) {
    return (
      <div className="card mb-3 text-sm text-gray-600">
        No CRM connections yet.{" "}
        <Link href="/settings/integrations" className="text-brand-700 underline">
          Connect Salesforce or HubSpot
        </Link>{" "}
        to pull accounts and contacts as hints.
      </div>
    );
  }

  return (
    <form
      className="card mb-3 grid grid-cols-1 gap-3 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ orgMapId, connectionId, accountQuery });
      }}
    >
      <div>
        <label className="label">Connection</label>
        <select className="input" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.provider})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Account name to search</label>
        <input
          className="input"
          value={accountQuery}
          onChange={(e) => setAccountQuery(e.target.value)}
          placeholder="Acme"
          required
        />
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary">
          Pull hints
        </button>
      </div>
    </form>
  );
}

function HintsPanel({ hints, onResolved }: { hints: Hint[]; onResolved: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, action: "accept" | "dismiss") {
    setBusy(id);
    await fetch(`/api/hints/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    onResolved();
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        🍃 Hints {hints.length > 0 && `(${hints.length})`}
      </h2>
      {hints.length === 0 && (
        <p className="text-sm text-gray-500">
          No pending hints. Run a CRM sync to discover new contacts and updates.
        </p>
      )}
      <ul className="space-y-2">
        {hints.map((h) => {
          const p = JSON.parse(h.payload);
          const label =
            h.kind === "new_company"
              ? `New company: ${p.account?.name}`
              : h.kind === "new_person"
                ? `New person: ${p.contact?.firstName} ${p.contact?.lastName}${p.contact?.title ? ` — ${p.contact.title}` : ""}`
                : `Update: ${Object.keys(p.changes ?? {}).join(", ")}`;
          return (
            <li key={h.id} className="card py-2.5">
              <div className="text-sm">{label}</div>
              <div className="mt-0.5 text-xs text-gray-500">from {h.provider}</div>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary !px-2 !py-1 text-xs"
                  disabled={busy === h.id}
                  onClick={() => resolve(h.id, "accept")}
                >
                  Accept
                </button>
                <button
                  className="btn-secondary !px-2 !py-1 text-xs"
                  disabled={busy === h.id}
                  onClick={() => resolve(h.id, "dismiss")}
                >
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
