import { db } from "../db";
import { logActivity } from "../activity";
import { decryptSecret } from "../secrets";
import { CrmAdapter, CrmContact, CrmAccount } from "./types";
import { salesforceAdapter } from "./salesforce";
import { hubspotAdapter } from "./hubspot";

// The sync engine is deliberately hint-first (like ancestry): instead of
// silently mutating the map, a CRM pull produces pending Hints that a human
// accepts or dismisses. Accepting writes the entity, the ExternalLink (so
// re-syncs are idempotent), a Source citation, and an Activity entry.

export function adapterForConnection(conn: {
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  instanceUrl: string | null;
}): CrmAdapter {
  const auth = {
    accessToken: decryptSecret(conn.accessToken),
    refreshToken: conn.refreshToken ? decryptSecret(conn.refreshToken) : null,
    instanceUrl: conn.instanceUrl,
  };
  if (conn.provider === "salesforce") return salesforceAdapter(auth);
  if (conn.provider === "hubspot") return hubspotAdapter(auth);
  throw new Error(`Unknown CRM provider: ${conn.provider}`);
}

export type HintPayload =
  | { kind: "new_company"; connectionId: string; account: CrmAccount }
  | { kind: "new_person"; connectionId: string; contact: CrmContact; companyId?: string }
  | {
      kind: "update_person";
      connectionId: string;
      personId: string;
      contact: CrmContact;
      changes: Record<string, { from: string | null; to: string | null }>;
    };

export async function runSync(args: {
  connectionId: string;
  orgMapId: string;
  accountQuery: string; // company name to search in the CRM
  userId?: string;
}) {
  const conn = await db.crmConnection.findUniqueOrThrow({ where: { id: args.connectionId } });
  const adapter = adapterForConnection(conn);

  const accounts = await adapter.fetchAccounts(args.accountQuery);
  let hintsCreated = 0;

  for (const account of accounts) {
    const accountLink = await db.externalLink.findUnique({
      where: {
        connectionId_externalType_externalId: {
          connectionId: conn.id,
          externalType: account.externalType,
          externalId: account.externalId,
        },
      },
    });

    if (!accountLink) {
      const created = await upsertPendingHint(args.orgMapId, conn.provider, "new_company", {
        kind: "new_company",
        connectionId: conn.id,
        account,
      });
      hintsCreated += created;
    }

    const contacts = await adapter.fetchContactsForAccount(account.externalId);
    for (const contact of contacts) {
      const contactLink = await db.externalLink.findUnique({
        where: {
          connectionId_externalType_externalId: {
            connectionId: conn.id,
            externalType: contact.externalType,
            externalId: contact.externalId,
          },
        },
        include: { person: true },
      });

      if (!contactLink) {
        const created = await upsertPendingHint(args.orgMapId, conn.provider, "new_person", {
          kind: "new_person",
          connectionId: conn.id,
          contact,
          companyId: accountLink?.companyId ?? undefined,
        });
        hintsCreated += created;
      } else if (contactLink.person) {
        // Already linked: diff the CRM record against ours and propose updates.
        const p = contactLink.person;
        const changes: Record<string, { from: string | null; to: string | null }> = {};
        if (contact.email && contact.email !== p.email)
          changes.email = { from: p.email, to: contact.email };
        if (contact.phone && contact.phone !== p.phone)
          changes.phone = { from: p.phone, to: contact.phone };
        if (Object.keys(changes).length > 0) {
          const created = await upsertPendingHint(args.orgMapId, conn.provider, "update_person", {
            kind: "update_person",
            connectionId: conn.id,
            personId: p.id,
            contact,
            changes,
          });
          hintsCreated += created;
        }
      }
    }
  }

  await db.crmConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date() },
  });
  await logActivity({
    orgMapId: args.orgMapId,
    userId: args.userId,
    verb: "synced",
    entity: "connection",
    entityId: conn.id,
    summary: `Synced ${conn.provider} for "${args.accountQuery}" — ${hintsCreated} new hint(s)`,
  });

  return { hintsCreated };
}

// Avoid duplicate pending hints for the same external record.
async function upsertPendingHint(
  orgMapId: string,
  provider: string,
  kind: string,
  payload: HintPayload
): Promise<number> {
  const externalId =
    payload.kind === "new_company" ? payload.account.externalId : payload.contact.externalId;
  const existing = await db.hint.findFirst({
    where: { orgMapId, provider, kind, status: "pending" },
  });
  if (existing) {
    const p = JSON.parse(existing.payload) as HintPayload;
    const existingExternalId =
      p.kind === "new_company" ? p.account.externalId : p.contact.externalId;
    if (existingExternalId === externalId) return 0;
  }
  const dupe = await db.hint.findMany({
    where: { orgMapId, provider, kind, status: "pending" },
  });
  for (const h of dupe) {
    const p = JSON.parse(h.payload) as HintPayload;
    const id = p.kind === "new_company" ? p.account.externalId : p.contact.externalId;
    if (id === externalId) return 0;
  }
  await db.hint.create({
    data: { orgMapId, provider, kind, payload: JSON.stringify(payload) },
  });
  return 1;
}

export async function acceptHint(hintId: string, userId?: string) {
  const hint = await db.hint.findUniqueOrThrow({ where: { id: hintId } });
  if (hint.status !== "pending") throw new Error("Hint already resolved");
  const payload = JSON.parse(hint.payload) as HintPayload;

  const source = await db.source.create({
    data: {
      kind: hint.provider,
      title: `${hint.provider === "salesforce" ? "Salesforce" : "HubSpot"} sync`,
      detail: `Accepted hint ${hint.id}`,
    },
  });

  if (payload.kind === "new_company") {
    const company = await db.company.create({
      data: {
        orgMapId: hint.orgMapId,
        name: payload.account.name,
        domain: payload.account.domain,
        industry: payload.account.industry,
      },
    });
    await db.externalLink.create({
      data: {
        connectionId: payload.connectionId,
        provider: hint.provider,
        externalType: payload.account.externalType,
        externalId: payload.account.externalId,
        companyId: company.id,
      },
    });
    await logActivity({
      orgMapId: hint.orgMapId,
      userId,
      verb: "accepted_hint",
      entity: "company",
      entityId: company.id,
      summary: `Added company "${company.name}" from ${hint.provider}`,
    });
  } else if (payload.kind === "new_person") {
    const person = await db.person.create({
      data: {
        orgMapId: hint.orgMapId,
        firstName: payload.contact.firstName,
        lastName: payload.contact.lastName,
        email: payload.contact.email,
        phone: payload.contact.phone,
      },
    });
    if (payload.companyId && payload.contact.title) {
      await db.position.create({
        data: {
          personId: person.id,
          companyId: payload.companyId,
          title: payload.contact.title,
        },
      });
    }
    await db.externalLink.create({
      data: {
        connectionId: payload.connectionId,
        provider: hint.provider,
        externalType: payload.contact.externalType,
        externalId: payload.contact.externalId,
        personId: person.id,
      },
    });
    await db.fact.create({
      data: {
        label: "Imported from CRM",
        value: `${hint.provider} contact ${payload.contact.externalId}`,
        confidence: "verified",
        personId: person.id,
        sourceId: source.id,
        createdBy: userId,
      },
    });
    await logActivity({
      orgMapId: hint.orgMapId,
      userId,
      verb: "accepted_hint",
      entity: "person",
      entityId: person.id,
      summary: `Added ${person.firstName} ${person.lastName} from ${hint.provider}`,
    });
  } else if (payload.kind === "update_person") {
    const data: Record<string, string> = {};
    for (const [field, change] of Object.entries(payload.changes)) {
      if (change.to != null) data[field] = change.to;
    }
    const person = await db.person.update({ where: { id: payload.personId }, data });
    await logActivity({
      orgMapId: hint.orgMapId,
      userId,
      verb: "accepted_hint",
      entity: "person",
      entityId: person.id,
      summary: `Updated ${person.firstName} ${person.lastName} from ${hint.provider} (${Object.keys(payload.changes).join(", ")})`,
    });
  }

  await db.hint.update({
    where: { id: hint.id },
    data: { status: "accepted", resolvedAt: new Date() },
  });
}

export async function dismissHint(hintId: string) {
  await db.hint.update({
    where: { id: hintId },
    data: { status: "dismissed", resolvedAt: new Date() },
  });
}
