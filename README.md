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
- **Team knowledge sharing**: shared workspaces with invite links, full contribution history,
  teammates' LinkedIn connections surfaced on person pages.
- **Real accounts & security**: email/password auth (scrypt-hashed) with server-side sessions,
  workspace-scoped authorization on every API route, CRM tokens encrypted at rest (AES-256-GCM),
  and global search across people, companies, facts, and research.

## Quick start (local dev)

```bash
npm install
cp .env.example .env
docker compose up db -d     # local PostgreSQL (or point DATABASE_URL anywhere)
npx prisma migrate deploy   # apply schema migrations
npm run db:seed             # demo workspace: Acme + Globex maps
npm run dev                 # http://localhost:3000
npm test                    # unit tests (CSV parsing, degree BFS, crypto)
```

Sign in with the seeded demo account — **demo@example.com / demo-password-123** — to explore two
prospect maps with an influence graph, sourced facts, and LinkedIn connections. Or sign up fresh
and invite teammates from *Team* (each signup gets its own isolated workspace).

> Production note: set `APP_SECRET` (e.g. `openssl rand -hex 32`) — token encryption requires it
> and the app refuses to encrypt without it outside dev.

## Deploying for test users

### Option A — single server with Docker (simplest)

On any box with Docker (a $6 VPS, EC2, your office server):

```bash
git clone <this repo> && cd Corporate-mapper
APP_SECRET=$(openssl rand -hex 32) APP_BASE_URL=https://your-domain docker compose up -d --build
```

That starts PostgreSQL and the app (with migrations applied on boot) on port 3000; put your
favorite reverse proxy (Caddy gives you HTTPS in two lines) in front. Uploaded files and the
database live in named volumes. Set `SEED_DEMO=true` for the demo dataset, or just have test
users sign up — the first user creates a workspace and invites the rest from the **Team** page.

### Option B — Vercel + managed Postgres (no servers)

1. Push this repo to GitHub and import it at vercel.com (framework auto-detected; `postinstall`
   runs `prisma generate`).
2. Add a Postgres database (Vercel Postgres / Neon / Supabase) and set `DATABASE_URL`.
3. Set env vars: `APP_SECRET`, `APP_BASE_URL` (your vercel URL), and — because serverless disks
   are ephemeral — an S3-compatible bucket for uploads: `S3_BUCKET`, `S3_REGION`,
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (Cloudflare R2 works via `S3_ENDPOINT`).
4. Run migrations once against the production DB: `DATABASE_URL=... npx prisma migrate deploy`.

### Option C — Render / Railway / Fly.io

All three build the included `Dockerfile` directly and offer managed Postgres add-ons. Set the
same env vars as above; the entrypoint applies migrations on every boot, and a persistent volume
mounted at `/app/storage` (or S3 vars) covers uploads. Health checks: `GET /api/health`.

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
