import { CrmAdapter, CrmAccount, CrmContact, ConnectionAuth } from "./types";

// Salesforce adapter using the plain REST API (no SDK dependency).
// Auth: OAuth 2.0 web-server flow via a Connected App — see
// src/app/api/integrations/salesforce/oauth/. Requires `api refresh_token`
// scopes.

const API_VERSION = "v59.0";

async function soql<T>(auth: ConnectionAuth, query: string): Promise<T[]> {
  if (!auth.instanceUrl) throw new Error("Salesforce connection missing instanceUrl");
  const url = `${auth.instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Salesforce query failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { records: T[] };
  return body.records;
}

function escapeSoql(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function salesforceAdapter(auth: ConnectionAuth): CrmAdapter {
  return {
    provider: "salesforce",

    async fetchAccounts(query: string): Promise<CrmAccount[]> {
      const q = escapeSoql(query);
      const records = await soql<any>(
        auth,
        `SELECT Id, Name, Website, Industry FROM Account WHERE Name LIKE '%${q}%' LIMIT 50`
      );
      return records.map((r) => ({
        externalId: r.Id,
        externalType: "Account",
        name: r.Name,
        domain: r.Website ?? undefined,
        industry: r.Industry ?? undefined,
      }));
    },

    async fetchContactsForAccount(accountExternalId: string): Promise<CrmContact[]> {
      const records = await soql<any>(
        auth,
        `SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId FROM Contact WHERE AccountId = '${escapeSoql(accountExternalId)}' LIMIT 200`
      );
      return records.map((r) => ({
        externalId: r.Id,
        externalType: "Contact",
        firstName: r.FirstName ?? "",
        lastName: r.LastName ?? "",
        email: r.Email ?? undefined,
        phone: r.Phone ?? undefined,
        title: r.Title ?? undefined,
        accountExternalId: r.AccountId ?? undefined,
      }));
    },

    async pushContact(contact) {
      if (!auth.instanceUrl) throw new Error("Salesforce connection missing instanceUrl");
      const base = `${auth.instanceUrl}/services/data/${API_VERSION}/sobjects/Contact`;
      const payload = {
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Email: contact.email,
        Phone: contact.phone,
        Title: contact.title,
      };
      const url = contact.externalId ? `${base}/${contact.externalId}` : base;
      const res = await fetch(url, {
        method: contact.externalId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Salesforce push failed (${res.status}): ${await res.text()}`);
      }
      if (contact.externalId) return contact.externalId;
      const body = (await res.json()) as { id: string };
      return body.id;
    },
  };
}

// --- OAuth helpers (web server flow) ---

export function salesforceAuthUrl(state: string) {
  const loginUrl = process.env.SFDC_LOGIN_URL || "https://login.salesforce.com";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SFDC_CLIENT_ID || "",
    redirect_uri: `${process.env.APP_BASE_URL}/api/integrations/salesforce/oauth/callback`,
    scope: "api refresh_token",
    state,
  });
  return `${loginUrl}/services/oauth2/authorize?${params}`;
}

export async function salesforceExchangeCode(code: string) {
  const loginUrl = process.env.SFDC_LOGIN_URL || "https://login.salesforce.com";
  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.SFDC_CLIENT_ID || "",
      client_secret: process.env.SFDC_CLIENT_SECRET || "",
      redirect_uri: `${process.env.APP_BASE_URL}/api/integrations/salesforce/oauth/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Salesforce token exchange failed: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    instance_url: string;
  };
}
