# Architecture

## Overview

```
┌────────────────────────────────────────────────────────────┐
│ Next.js App Router                                         │
│                                                            │
│  UI pages (RSC + client components)     API routes        │
│  /            dashboard + activity      /api/maps         │
│  /maps/[id]   org chart workspace       /api/people       │
│  /people/[id] person profile            /api/edges        │
│  /network     multi-org zoom-out        /api/facts        │
│  /linkedin    connection import         /api/artifacts    │
│  /settings/integrations                 /api/hints        │
│                                         /api/linkedin/*   │
│                                         /api/integrations/*│
├────────────────────────────────────────────────────────────┤
│ Domain libs (src/lib)                                      │
│  network.ts   degree-of-connection BFS, org-bridge graph  │
│  linkedin.ts  CSV parse + contact matching                │
│  crm/sync.ts  hint-first sync engine                      │
│  crm/{salesforce,hubspot}.ts  REST adapters (CrmAdapter)  │
│  storage.ts   file storage (local disk; swap for S3)      │
│  activity.ts  contribution log                            │
├────────────────────────────────────────────────────────────┤
│ Prisma → SQLite (dev) / PostgreSQL (prod)                  │
└────────────────────────────────────────────────────────────┘
```

## Data model

Core entities (see `prisma/schema.prisma` for the full commented schema):

- **Workspace / User / Membership** — team collaboration boundary. All queries scope through
  the workspace.
- **OrgMap** — the "tree": one per prospect account.
- **Company** — org units inside a map; self-relation models subsidiaries/divisions.
- **Person + Position** — Position keeps `current` + date range, so role history accumulates the
  way ancestry keeps superseded life events. A person moving jobs preserves the old position —
  which is exactly what powers cross-org work-history bridges.
- **Edge** — typed person↔person relationship. `REPORTS_TO` edges define the chart hierarchy;
  the rest (`INFLUENCES`, `ALLY_OF`, `CONFLICT_WITH`, `FORMER_COLLEAGUE`, `MENTOR_OF`,
  `DOTTED_LINE`) form the influence overlay, with 1–5 strength.
- **Fact → Source** — citable intel with confidence (`verified`/`likely`/`unverified`). Sources
  are first-class (kind, title, URL, detail) so knowledge carries provenance.
- **Artifact** — file/link/note attached to a person or company. Files live in `STORAGE_DIR`
  via the two-function contract in `storage.ts`.
- **Hint** — pending suggestion from a CRM sync, with a JSON payload of the proposed change.
- **CrmConnection + ExternalLink** — tokens per provider, and a per-record mapping of internal
  IDs to external CRM IDs (unique on `connectionId+externalType+externalId`) making syncs
  idempotent and enabling push-back.
- **LinkedInContact** — one row per connection from a user's LinkedIn data export, optionally
  matched to a Person.
- **Activity** — append-only contribution history per map.

## CRM sync design (hint-first)

`runSync(connection, orgMap, accountQuery)`:

1. Adapter fetches accounts matching the query, then contacts per account.
2. For each record, check `ExternalLink`:
   - unlinked → create a `new_company` / `new_person` hint (deduped per external ID);
   - linked → diff CRM fields against ours → `update_person` hint when they differ.
3. Humans accept/dismiss hints in the map sidebar. Accepting writes the entity + ExternalLink +
   a Source citation + an Activity entry, in that order.

This mirrors ancestry's hints: automation proposes, people decide, and provenance is kept. The
`CrmAdapter` interface (`fetchAccounts`, `fetchContactsForAccount`, `pushContact`) is the entire
provider contract — a new CRM is one adapter file.

Both adapters use plain `fetch` against REST APIs (SFDC REST + SOQL, HubSpot CRM v3/v4), no SDKs.
OAuth web-server flows are implemented for both; HubSpot also accepts a Private App token pasted
directly, which is the fastest path to a working connection.

## Degrees of connection

`computeDegrees(userId, workspaceId)` builds an undirected graph over all people in the
workspace:

- hop = any relationship Edge, or shared employment (two people with positions — current or
  former — at the same company);
- seeds = people matched to the user's LinkedIn contacts (degree 1);
- BFS outward, capped at degree 5.

Degrees render as badges on chart nodes and person pages. Matching contact→person happens at
import time by email, LinkedIn URL, or name + fuzzy company match, and can be corrected manually
(`PATCH /api/linkedin/contacts/[id]`).

## Multi-org network view

`buildOrgNetwork` merges companies across maps into org nodes (keyed by domain, else normalized
name), then derives bridges:

- **work_history** — one person holds positions at two orgs (current or former);
- **relationship** — an Edge whose endpoints sit in different orgs;
- **your paths** — orgs containing the user's 1st-degree contacts (matched people, or free-text
  company match from the LinkedIn export).

Rendered as a radial React Flow graph with a "You" node in the center; clicking an org opens its
map.

## Auth & multi-tenancy

- **Accounts**: email/password with scrypt hashing (`src/lib/password.ts`, Node crypto — no
  native deps). Login/signup/logout under `/api/auth/*`.
- **Sessions**: random 256-bit tokens in a `Session` table, delivered via an httpOnly
  `cm_session` cookie (30-day expiry, `secure` in production). `src/middleware.ts` redirects
  anonymous page visits to `/login`; real validation happens server-side in
  `requireUser()` (pages) and `requireApiUser()` (API → 401).
- **Authorization**: every API route resolves the caller's workspaces and asserts the target
  entity belongs to one of them (`src/lib/authz.ts`: `assertMapAccess`, `assertPersonAccess`,
  …) before reading or writing. File downloads check the owning workspace too. Routes wrap in
  `withApiErrors()` for uniform 401/403/400/500 mapping.
- **Workspaces & invites**: signup creates a personal workspace; invite links
  (`/api/team/invites` → `/invite/[token]`) let teammates join an existing one, optionally
  pinned to an email and expiring after 14 days. All research, maps, and CRM connections are
  workspace-shared.
- **Secrets at rest**: CRM tokens are AES-256-GCM encrypted (`src/lib/secrets.ts`) under a key
  derived from `APP_SECRET` (mandatory in production); legacy plaintext rows are tolerated on
  read so encryption can be introduced without a migration.

## Testing

`npm test` (vitest) covers the pure cores: LinkedIn CSV parsing (quotes, preambles, malformed
files), degree-of-connection BFS (shortest paths, caps, invalid seeds), shared-employer hop
building, password hashing, and secret encryption round-trips.

## Production hardening checklist

Remaining simplifications to address before real deployment:

- **Database**: switch the datasource provider to `postgresql`; the schema avoids
  SQLite-specific features.
- **Storage**: replace local-disk `storage.ts` with S3/GCS (two-function contract).
- **Token refresh**: implement refresh-token rotation for SFDC/HubSpot (refresh endpoints
  exist on both providers; adapters surface 401s).
- **Sync at scale**: move `runSync` to a background job (cron / queue), add webhook receivers
  for HubSpot subscriptions and SFDC CDC for near-real-time hints.
- **Search**: swap LIKE-based search for Postgres FTS as data grows.
- **Rate limiting / CSRF**: add a rate limiter on `/api/auth/*` and CSRF tokens if the app
  ever serves cross-origin embeds (cookies are SameSite=Lax, which covers the basics).
- **Roles**: membership roles (owner/admin/member/viewer) exist but aren't yet enforced as
  distinct permission tiers.
