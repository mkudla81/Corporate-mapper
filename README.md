# Corporate Mapper

**Ancestry.com for B2B sales.** A collaborative platform where sales teams map the org structure
of their prospects, share research, and build institutional knowledge about buying committees —
with Salesforce, HubSpot, and LinkedIn data woven in.

## The ancestry.com analogy

| Ancestry concept | Corporate Mapper equivalent |
| --- | --- |
| Family tree | **Org Map** — one collaborative map per prospect account |
| Person page | **Person profile** — contact details, role history, disposition (champion/blocker/…) |
| Family links | **Edges** — `REPORTS_TO` plus the informal influence map (`INFLUENCES`, `ALLY_OF`, `CONFLICT_WITH`, `FORMER_COLLEAGUE`, …) |
| Facts with source citations | **Facts** — discrete, citable intel with confidence levels, linked to **Sources** (call notes, emails, LinkedIn, CRM, web) |
| Records & media gallery | **Artifacts** — files, links, and notes attached to people and companies |
| Shaking-leaf hints | **Hints** — CRM syncs propose new people/companies/updates; humans accept or dismiss |
| Tree change history | **Activity feed** — every contribution logged, visible to the team |
| Record collections | **CRM connections** — Salesforce & HubSpot with per-record external-ID linkage |

## Features

- **Interactive org charts** (React Flow): solid lines for reporting structure, dashed colored
  overlays for the influence map. Drag, zoom, click through to person profiles.
- **Person profiles** with sourced facts, confidence levels, role history (people keep their
  history when they change jobs — like superseded life events), research files/links/notes.
- **Salesforce + HubSpot sync**: pull accounts and contacts as *hints*; accepting a hint creates
  the entity, an external-ID link (so re-syncs are idempotent), a source citation, and an
  activity entry. Bidirectional push supported by the adapters.
- **LinkedIn network overlay**: import your `Connections.csv` (LinkedIn data export); contacts
  auto-match to mapped people by email/profile-URL/name+company. Every chart node and person page
  shows your **degree of connection** (1st = direct; 2nd+ computed by BFS over relationships and
  shared work history).
- **Multi-org network view**: zoom out to see all target orgs and the bridges between them —
  people whose work history spans orgs, cross-org relationships, and your own 1st-degree paths
  into each account.
- **Team knowledge sharing**: shared workspace, full contribution history, teammates' LinkedIn
  connections surfaced on person pages.

## Quick start

```bash
npm install
cp .env.example .env        # defaults work for local dev (SQLite)
npm run db:push             # create the database schema
npm run db:seed             # demo workspace: Acme + Globex maps
npm run dev                 # http://localhost:3000
```

The seed gives you a demo rep with two prospect maps, an influence graph, sourced facts, and
LinkedIn connections so every feature is visible immediately.

## Connecting CRMs

**HubSpot (fastest):** create a [Private App](https://developers.hubspot.com/docs/api/private-apps)
with `crm.objects.contacts.read/write` + `crm.objects.companies.read` scopes, then paste the token
in *Settings → Integrations*. For full OAuth, set `HUBSPOT_CLIENT_ID`/`HUBSPOT_CLIENT_SECRET` in `.env`.

**Salesforce:** create a Connected App with OAuth (`api refresh_token` scopes), set
`SFDC_CLIENT_ID`/`SFDC_CLIENT_SECRET`, and use the *Connect Salesforce* button — or paste an access
token + instance URL directly.

Then open a map → **⟳ Sync from CRM** → enter the account name. Matching accounts/contacts arrive
as hints in the map's sidebar.

## Importing LinkedIn connections

LinkedIn → *Settings & Privacy → Data privacy → Get a copy of your data → Connections*. Upload the
resulting `Connections.csv` on the **LinkedIn** page. (This uses LinkedIn's official data export —
no scraping.)

## Stack & architecture

Next.js 14 (App Router) · TypeScript · Prisma (SQLite dev, Postgres-ready) · React Flow ·
Tailwind. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, sync design, and
production hardening notes.
