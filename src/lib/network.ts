import { db } from "./db";

// Graph analytics over the workspace: degrees of connection from the current
// user, and the zoomed-out multi-org view with the bridges between orgs.

// ---------------------------------------------------------------------------
// Degrees of connection
// ---------------------------------------------------------------------------
// Degree 1: people matched to the user's imported LinkedIn connections.
// Degree n: reachable in n-1 hops from a degree-1 person, where a "hop" is a
// mapped relationship Edge (any type) or shared employment (two people with
// positions — current or former — at the same company).

export async function computeDegrees(
  userId: string,
  workspaceId: string
): Promise<Map<string, number>> {
  const people = await db.person.findMany({
    where: { orgMap: { workspaceId } },
    select: { id: true, positions: { select: { companyId: true } } },
  });
  const edges = await db.edge.findMany({
    where: { orgMap: { workspaceId } },
    select: { fromId: true, toId: true },
  });
  const firstDegree = await db.linkedInContact.findMany({
    where: { userId, personId: { not: null } },
    select: { personId: true },
  });

  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (const e of edges) link(e.fromId, e.toId);

  // Shared-employer hops: index people by company.
  const byCompany = new Map<string, string[]>();
  for (const p of people) {
    for (const pos of p.positions) {
      byCompany.set(pos.companyId, [...(byCompany.get(pos.companyId) ?? []), p.id]);
    }
  }
  for (const ids of Array.from(byCompany.values())) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) link(ids[i], ids[j]);
    }
  }

  // BFS from the 1st-degree set.
  const degrees = new Map<string, number>();
  let frontier = Array.from(new Set(firstDegree.map((c) => c.personId!))).filter((id) =>
    people.some((p) => p.id === id)
  );
  for (const id of frontier) degrees.set(id, 1);
  let depth = 1;
  while (frontier.length > 0 && depth < 6) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of Array.from(adjacency.get(id) ?? [])) {
        if (!degrees.has(neighbor)) {
          degrees.set(neighbor, depth + 1);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    depth++;
  }
  return degrees;
}

// ---------------------------------------------------------------------------
// Multi-org network ("zoom out")
// ---------------------------------------------------------------------------
// Org nodes are companies merged across maps by domain (or normalized name).
// Bridges between orgs:
//   work_history — one person holds positions (current/former) at both orgs
//   relationship — a mapped Edge connects people sitting in different orgs
// Plus "you" edges: orgs where the user has 1st-degree LinkedIn contacts.

export interface OrgNode {
  key: string;
  name: string;
  mapIds: string[];
  mapNames: string[];
  peopleCount: number;
  yourContacts: string[]; // names of the user's 1st-degree contacts there
}

export interface OrgBridge {
  fromKey: string;
  toKey: string;
  kind: "work_history" | "relationship";
  label: string; // e.g. "Sofia Alvarez (VP Eng @ Acme, ex-Globex)"
  personId: string;
}

export async function buildOrgNetwork(userId: string, workspaceId: string) {
  const companies = await db.company.findMany({
    where: { orgMap: { workspaceId } },
    include: { orgMap: { select: { id: true, name: true } } },
  });
  const people = await db.person.findMany({
    where: { orgMap: { workspaceId } },
    include: { positions: { include: { company: true } } },
  });
  const edges = await db.edge.findMany({
    where: { orgMap: { workspaceId } },
    select: { fromId: true, toId: true, type: true },
  });
  const contacts = await db.linkedInContact.findMany({ where: { userId } });

  // Merge companies into org nodes by domain, else normalized name.
  const orgKey = (c: { name: string; domain: string | null }) =>
    c.domain ? `domain:${c.domain.toLowerCase()}` : `name:${c.name.trim().toLowerCase()}`;

  const nodes = new Map<string, OrgNode>();
  const companyToKey = new Map<string, string>();
  for (const c of companies) {
    const key = orgKey(c);
    companyToKey.set(c.id, key);
    const existing = nodes.get(key);
    if (existing) {
      if (!existing.mapIds.includes(c.orgMap.id)) {
        existing.mapIds.push(c.orgMap.id);
        existing.mapNames.push(c.orgMap.name);
      }
    } else {
      nodes.set(key, {
        key,
        name: c.name,
        mapIds: [c.orgMap.id],
        mapNames: [c.orgMap.name],
        peopleCount: 0,
        yourContacts: [],
      });
    }
  }

  // Count people per org and remember each person's org set.
  const personOrgs = new Map<string, Set<string>>();
  const personById = new Map(people.map((p) => [p.id, p]));
  for (const p of people) {
    const orgs = new Set<string>();
    for (const pos of p.positions) {
      const key = companyToKey.get(pos.companyId);
      if (key) orgs.add(key);
    }
    personOrgs.set(p.id, orgs);
    const current = p.positions.find((pos) => pos.current);
    const currentKey = current ? companyToKey.get(current.companyId) : undefined;
    if (currentKey) nodes.get(currentKey)!.peopleCount++;
  }

  // Your 1st-degree contacts inside each org (matched person's org, or the
  // contact's free-text company matching an org name).
  for (const c of contacts) {
    const display = `${c.firstName} ${c.lastName}`;
    let keys: string[] = [];
    if (c.personId && personOrgs.has(c.personId)) {
      keys = Array.from(personOrgs.get(c.personId)!);
    } else if (c.company) {
      const target = c.company.trim().toLowerCase();
      keys = Array.from(nodes.values())
        .filter(
          (n) =>
            n.name.toLowerCase().includes(target) || target.includes(n.name.toLowerCase())
        )
        .map((n) => n.key);
    }
    for (const key of keys) {
      const node = nodes.get(key);
      if (node && !node.yourContacts.includes(display)) node.yourContacts.push(display);
    }
  }

  // Bridges.
  const bridges: OrgBridge[] = [];
  const seen = new Set<string>();
  const addBridge = (b: OrgBridge) => {
    const sig = [b.fromKey, b.toKey].sort().join("|") + b.kind + b.personId;
    if (b.fromKey === b.toKey || seen.has(sig)) return;
    seen.add(sig);
    bridges.push(b);
  };

  // Work-history bridges: a person with positions in 2+ orgs.
  for (const p of people) {
    const orgs = Array.from(personOrgs.get(p.id) ?? []);
    if (orgs.length < 2) continue;
    const current = p.positions.find((pos) => pos.current);
    for (let i = 0; i < orgs.length; i++) {
      for (let j = i + 1; j < orgs.length; j++) {
        addBridge({
          fromKey: orgs[i],
          toKey: orgs[j],
          kind: "work_history",
          label: `${p.firstName} ${p.lastName}${current ? ` (${current.title} @ ${current.company.name})` : ""}`,
          personId: p.id,
        });
      }
    }
  }

  // Relationship bridges: an Edge whose endpoints sit in different orgs.
  for (const e of edges) {
    const fromOrgs = personOrgs.get(e.fromId) ?? new Set();
    const toOrgs = personOrgs.get(e.toId) ?? new Set();
    for (const a of Array.from(fromOrgs)) {
      for (const b of Array.from(toOrgs)) {
        if (a === b) continue;
        const from = personById.get(e.fromId)!;
        const to = personById.get(e.toId)!;
        addBridge({
          fromKey: a,
          toKey: b,
          kind: "relationship",
          label: `${from.firstName} ${from.lastName} ${e.type.replace(/_/g, " ").toLowerCase()} ${to.firstName} ${to.lastName}`,
          personId: e.fromId,
        });
      }
    }
  }

  return { nodes: Array.from(nodes.values()), bridges };
}
