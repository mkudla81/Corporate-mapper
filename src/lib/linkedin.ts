import { db } from "./db";

// LinkedIn doesn't expose connections via public API, so the compliant path
// is the user's own data export: Settings → Get a copy of your data →
// Connections.csv. This module parses that CSV and matches contacts to
// Person records across the workspace's maps.

export interface ParsedConnection {
  firstName: string;
  lastName: string;
  profileUrl?: string;
  email?: string;
  company?: string;
  position?: string;
  connectedOn?: Date;
}

// Minimal RFC-4180-ish CSV parser (quotes, embedded commas/newlines).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// LinkedIn exports sometimes prepend a "Notes:" preamble before the real
// header row — scan for the row that contains "First Name".
export function parseConnectionsCsv(text: string): ParsedConnection[] {
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === "first name"));
  if (headerIdx === -1) {
    throw new Error('Could not find a "First Name" header — is this a LinkedIn Connections.csv?');
  }
  const header = rows[headerIdx].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    first: col("first name"),
    last: col("last name"),
    url: col("url"),
    email: col("email address"),
    company: col("company"),
    position: col("position"),
    connectedOn: col("connected on"),
  };

  const out: ParsedConnection[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const firstName = (r[idx.first] ?? "").trim();
    const lastName = (r[idx.last] ?? "").trim();
    if (!firstName && !lastName) continue;
    const connectedRaw = idx.connectedOn >= 0 ? (r[idx.connectedOn] ?? "").trim() : "";
    const connectedOn = connectedRaw ? new Date(connectedRaw) : undefined;
    out.push({
      firstName,
      lastName,
      profileUrl: idx.url >= 0 ? (r[idx.url] ?? "").trim() || undefined : undefined,
      email: idx.email >= 0 ? (r[idx.email] ?? "").trim() || undefined : undefined,
      company: idx.company >= 0 ? (r[idx.company] ?? "").trim() || undefined : undefined,
      position: idx.position >= 0 ? (r[idx.position] ?? "").trim() || undefined : undefined,
      connectedOn: connectedOn && !isNaN(connectedOn.getTime()) ? connectedOn : undefined,
    });
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

// Import connections for a user: upsert by profile URL (fallback: name+company)
// and auto-match to Person records in the workspace by email, LinkedIn URL,
// or name + company.
export async function importConnections(userId: string, workspaceId: string, csvText: string) {
  const parsed = parseConnectionsCsv(csvText);

  const people = await db.person.findMany({
    where: { orgMap: { workspaceId } },
    include: { positions: { include: { company: true } } },
  });

  let imported = 0;
  let matched = 0;

  for (const c of parsed) {
    const match = people.find((p) => {
      if (c.email && p.email && norm(c.email) === norm(p.email)) return true;
      if (c.profileUrl && p.linkedin && norm(c.profileUrl) === norm(p.linkedin)) return true;
      const nameMatches =
        norm(p.firstName) === norm(c.firstName) && norm(p.lastName) === norm(c.lastName);
      if (!nameMatches) return false;
      if (!c.company) return false;
      return p.positions.some(
        (pos) =>
          norm(pos.company.name).includes(norm(c.company!)) ||
          norm(c.company!).includes(norm(pos.company.name))
      );
    });

    const data = {
      firstName: c.firstName,
      lastName: c.lastName,
      profileUrl: c.profileUrl,
      email: c.email,
      company: c.company,
      position: c.position,
      connectedOn: c.connectedOn,
      personId: match?.id,
    };

    if (c.profileUrl) {
      await db.linkedInContact.upsert({
        where: { userId_profileUrl: { userId, profileUrl: c.profileUrl } },
        create: { userId, ...data },
        update: data,
      });
    } else {
      const existing = await db.linkedInContact.findFirst({
        where: { userId, firstName: c.firstName, lastName: c.lastName, company: c.company ?? null },
      });
      if (existing) {
        await db.linkedInContact.update({ where: { id: existing.id }, data });
      } else {
        await db.linkedInContact.create({ data: { userId, ...data } });
      }
    }
    imported++;
    if (match) matched++;
  }

  return { imported, matched };
}
