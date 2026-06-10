// Common shape every CRM adapter normalizes into. The sync engine only ever
// sees these types, so adding another CRM (Pipedrive, Dynamics, ...) means
// writing one adapter file.

export interface CrmContact {
  externalId: string;
  externalType: string; // provider's object name, e.g. "Contact" / "contact"
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  accountExternalId?: string; // ties the contact to a CrmAccount
}

export interface CrmAccount {
  externalId: string;
  externalType: string; // "Account" / "company"
  name: string;
  domain?: string;
  industry?: string;
}

export interface CrmAdapter {
  provider: "salesforce" | "hubspot";
  // Pull contacts/accounts matching the prospect, typically filtered by
  // company name or domain.
  fetchAccounts(query: string): Promise<CrmAccount[]>;
  fetchContactsForAccount(accountExternalId: string): Promise<CrmContact[]>;
  // Push a minimal upsert back to the CRM (bidirectional sync).
  pushContact(contact: Partial<CrmContact> & { externalId?: string }): Promise<string>;
}

export interface ConnectionAuth {
  accessToken: string;
  refreshToken?: string | null;
  instanceUrl?: string | null;
}
