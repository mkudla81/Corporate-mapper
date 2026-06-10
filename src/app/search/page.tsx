import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, currentWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Workspace-wide search across people, companies, facts and research notes.
// ILIKE-based; swap to Postgres FTS at scale.
export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const workspaceId = currentWorkspaceId(user);
  const q = (searchParams.q ?? "").trim();

  if (!q) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="mt-2 text-sm text-gray-600">Type a query in the search box above.</p>
      </div>
    );
  }

  const inWorkspace = { orgMap: { workspaceId } };
  const [people, companies, facts, artifacts] = await Promise.all([
    db.person.findMany({
      where: {
        ...inWorkspace,
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { notes: { contains: q, mode: "insensitive" as const } },
        ],
      },
      include: { orgMap: true, positions: { where: { current: true }, include: { company: true } } },
      take: 20,
    }),
    db.company.findMany({
      where: { ...inWorkspace, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { domain: { contains: q, mode: "insensitive" as const } }] },
      include: { orgMap: true },
      take: 20,
    }),
    db.fact.findMany({
      where: {
        AND: [
          { OR: [{ label: { contains: q, mode: "insensitive" as const } }, { value: { contains: q, mode: "insensitive" as const } }] },
          {
            OR: [
              { person: { orgMap: { workspaceId } } },
              { company: { orgMap: { workspaceId } } },
            ],
          },
        ],
      },
      include: { person: { include: { orgMap: true } }, company: true, source: true },
      take: 20,
    }),
    db.artifact.findMany({
      where: {
        AND: [
          { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }] },
          {
            OR: [
              { person: { orgMap: { workspaceId } } },
              { company: { orgMap: { workspaceId } } },
            ],
          },
        ],
      },
      include: { person: true, company: true },
      take: 20,
    }),
  ]);

  const total = people.length + companies.length + facts.length + artifacts.length;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">
        Search results for “{q}” <span className="text-sm font-normal text-gray-500">({total})</span>
      </h1>

      {people.length > 0 && (
        <Section title="People">
          {people.map((p) => (
            <li key={p.id} className="card py-2.5 text-sm">
              <Link href={`/people/${p.id}`} className="font-medium text-brand-700 hover:underline">
                {p.firstName} {p.lastName}
              </Link>
              {p.positions[0] && (
                <span className="text-gray-600">
                  {" "}— {p.positions[0].title}, {p.positions[0].company.name}
                </span>
              )}
              <span className="ml-2 text-xs text-gray-400">{p.orgMap.name}</span>
            </li>
          ))}
        </Section>
      )}

      {companies.length > 0 && (
        <Section title="Companies">
          {companies.map((c) => (
            <li key={c.id} className="card py-2.5 text-sm">
              <Link href={`/maps/${c.orgMapId}`} className="font-medium text-brand-700 hover:underline">
                {c.name}
              </Link>
              {c.domain && <span className="ml-2 text-gray-500">{c.domain}</span>}
              <span className="ml-2 text-xs text-gray-400">{c.orgMap.name}</span>
            </li>
          ))}
        </Section>
      )}

      {facts.length > 0 && (
        <Section title="Facts & intel">
          {facts.map((f) => (
            <li key={f.id} className="card py-2.5 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {f.label}
              </span>
              <div>{f.value}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {f.person ? (
                  <Link href={`/people/${f.person.id}`} className="text-brand-700 hover:underline">
                    {f.person.firstName} {f.person.lastName}
                  </Link>
                ) : (
                  f.company?.name
                )}
                {f.source && <> · source: {f.source.title}</>}
              </div>
            </li>
          ))}
        </Section>
      )}

      {artifacts.length > 0 && (
        <Section title="Research & files">
          {artifacts.map((a) => (
            <li key={a.id} className="card py-2.5 text-sm">
              {a.person ? (
                <Link href={`/people/${a.person.id}`} className="font-medium text-brand-700 hover:underline">
                  {a.title}
                </Link>
              ) : (
                <span className="font-medium">{a.title}</span>
              )}
              <span className="ml-2 text-xs text-gray-400">{a.kind}</span>
              {a.body && <p className="mt-1 line-clamp-2 text-gray-600">{a.body}</p>}
            </li>
          ))}
        </Section>
      )}

      {total === 0 && <p className="text-sm text-gray-500">Nothing matched.</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}
