import { CrmAdapter, CrmAccount, CrmContact, ConnectionAuth } from "./types";

// HubSpot adapter over the CRM v3 REST API (no SDK dependency).
// Auth: either OAuth (client id/secret in env) or — the quick path — a
// Private App access token pasted directly when creating the connection.

const BASE = "https://api.hubapi.com";

async function hs<T>(auth: ConnectionAuth, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HubSpot request failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export function hubspotAdapter(auth: ConnectionAuth): CrmAdapter {
  return {
    provider: "hubspot",

    async fetchAccounts(query: string): Promise<CrmAccount[]> {
      const body = {
        query,
        limit: 50,
        properties: ["name", "domain", "industry"],
      };
      const data = await hs<{ results: any[] }>(auth, "/crm/v3/objects/companies/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return data.results.map((r) => ({
        externalId: r.id,
        externalType: "company",
        name: r.properties?.name ?? "",
        domain: r.properties?.domain ?? undefined,
        industry: r.properties?.industry ?? undefined,
      }));
    },

    async fetchContactsForAccount(accountExternalId: string): Promise<CrmContact[]> {
      // Company -> associated contacts, then batch-read their properties.
      const assoc = await hs<{ results: { toObjectId: number }[] }>(
        auth,
        `/crm/v4/objects/companies/${accountExternalId}/associations/contacts?limit=200`
      );
      if (assoc.results.length === 0) return [];
      const batch = await hs<{ results: any[] }>(auth, "/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        body: JSON.stringify({
          inputs: assoc.results.map((a) => ({ id: String(a.toObjectId) })),
          properties: ["firstname", "lastname", "email", "phone", "jobtitle"],
        }),
      });
      return batch.results.map((r) => ({
        externalId: r.id,
        externalType: "contact",
        firstName: r.properties?.firstname ?? "",
        lastName: r.properties?.lastname ?? "",
        email: r.properties?.email ?? undefined,
        phone: r.properties?.phone ?? undefined,
        title: r.properties?.jobtitle ?? undefined,
        accountExternalId,
      }));
    },

    async pushContact(contact) {
      const properties = {
        firstname: contact.firstName,
        lastname: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        jobtitle: contact.title,
      };
      if (contact.externalId) {
        await hs(auth, `/crm/v3/objects/contacts/${contact.externalId}`, {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        });
        return contact.externalId;
      }
      const created = await hs<{ id: string }>(auth, "/crm/v3/objects/contacts", {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
      return created.id;
    },
  };
}

// --- OAuth helpers ---

export function hubspotAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID || "",
    redirect_uri: `${process.env.APP_BASE_URL}/api/integrations/hubspot/oauth/callback`,
    scope: "crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read",
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params}`;
}

export async function hubspotExchangeCode(code: string) {
  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID || "",
      client_secret: process.env.HUBSPOT_CLIENT_SECRET || "",
      redirect_uri: `${process.env.APP_BASE_URL}/api/integrations/hubspot/oauth/callback`,
      code,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot token exchange failed: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
