import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeDegrees } from "@/lib/network";
import { FactForm } from "@/components/FactForm";
import { ArtifactForm } from "@/components/ArtifactForm";

function degreeLabel(degree: number) {
  return degree === 1 ? "1st" : degree === 2 ? "2nd" : degree === 3 ? "3rd" : `${degree}th`;
}

export const dynamic = "force-dynamic";

const CONFIDENCE_CHIP: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  likely: "bg-amber-100 text-amber-800",
  unverified: "bg-gray-100 text-gray-600",
};

export default async function PersonPage({ params }: { params: { id: string } }) {
  const person = await db.person.findUnique({
    where: { id: params.id },
    include: {
      orgMap: true,
      positions: { include: { company: true }, orderBy: [{ current: "desc" }, { startDate: "desc" }] },
      facts: { include: { source: true, author: true }, orderBy: { createdAt: "desc" } },
      artifacts: { include: { author: true }, orderBy: { createdAt: "desc" } },
      links: { include: { connection: { select: { label: true } } } },
      edgesFrom: { include: { to: true } },
      edgesTo: { include: { from: true } },
      linkedinContacts: { include: { user: { select: { name: true } } } },
    },
  });
  if (!person) notFound();

  const user = await getCurrentUser();
  const degrees = await computeDegrees(user.id, person.orgMap.workspaceId);
  const degree = degrees.get(person.id);
  const myContact = person.linkedinContacts.find((c) => c.userId === user.id);
  const teamContacts = person.linkedinContacts.filter((c) => c.userId !== user.id);

  const manager = person.edgesFrom.find((e) => e.type === "REPORTS_TO")?.to;
  const reports = person.edgesTo.filter((e) => e.type === "REPORTS_TO").map((e) => e.from);
  const relationships = [
    ...person.edgesFrom.filter((e) => e.type !== "REPORTS_TO").map((e) => ({ edge: e, other: e.to, dir: "→" })),
    ...person.edgesTo.filter((e) => e.type !== "REPORTS_TO").map((e) => ({ edge: e, other: e.from, dir: "←" })),
  ];

  return (
    <div>
      <Link href={`/maps/${person.orgMapId}`} className="text-sm text-brand-700 hover:underline">
        ← {person.orgMap.name}
      </Link>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Identity column */}
        <div className="space-y-4">
          <div className="card">
            <h1 className="text-xl font-semibold">
              {person.firstName} {person.lastName}
            </h1>
            {person.positions[0] && (
              <p className="text-sm text-gray-600">
                {person.positions[0].title} · {person.positions[0].company.name}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className="chip bg-brand-100 text-brand-700">
                {person.disposition.replace("_", " ")}
              </span>
              {degree != null && (
                <span
                  className={`chip ${degree === 1 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}`}
                >
                  {degreeLabel(degree)}-degree connection
                </span>
              )}
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              {person.email && (
                <div>
                  <dt className="inline text-gray-500">Email: </dt>
                  <dd className="inline">{person.email}</dd>
                </div>
              )}
              {person.phone && (
                <div>
                  <dt className="inline text-gray-500">Phone: </dt>
                  <dd className="inline">{person.phone}</dd>
                </div>
              )}
              {person.linkedin && (
                <div>
                  <dt className="inline text-gray-500">LinkedIn: </dt>
                  <dd className="inline">
                    <a href={person.linkedin} className="text-brand-700 hover:underline" target="_blank">
                      profile
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {person.notes && <p className="mt-3 text-sm text-gray-700">{person.notes}</p>}
          </div>

          <div className="card text-sm">
            <h2 className="mb-2 font-semibold">Org context</h2>
            {manager && (
              <p>
                Reports to{" "}
                <Link href={`/people/${manager.id}`} className="text-brand-700 hover:underline">
                  {manager.firstName} {manager.lastName}
                </Link>
              </p>
            )}
            {reports.length > 0 && (
              <p className="mt-1">
                Direct reports:{" "}
                {reports.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ", "}
                    <Link href={`/people/${r.id}`} className="text-brand-700 hover:underline">
                      {r.firstName} {r.lastName}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {relationships.length > 0 && (
              <ul className="mt-2 space-y-1">
                {relationships.map(({ edge, other, dir }) => (
                  <li key={edge.id + dir} className="text-gray-700">
                    <span className="text-xs uppercase text-gray-400">
                      {edge.type.replace(/_/g, " ")} {dir}
                    </span>{" "}
                    <Link href={`/people/${other.id}`} className="text-brand-700 hover:underline">
                      {other.firstName} {other.lastName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!manager && reports.length === 0 && relationships.length === 0 && (
              <p className="text-gray-500">No relationships mapped yet.</p>
            )}
          </div>

          <div className="card text-sm">
            <h2 className="mb-2 font-semibold">LinkedIn</h2>
            {myContact ? (
              <div>
                <p className="text-emerald-700">
                  ✓ Your 1st-degree connection
                  {myContact.connectedOn &&
                    ` since ${new Date(myContact.connectedOn).toLocaleDateString()}`}
                </p>
                {(myContact.position || myContact.company) && (
                  <p className="mt-1 text-gray-700">
                    {[myContact.position, myContact.company].filter(Boolean).join(" · ")}{" "}
                    <span className="text-xs text-gray-400">(per LinkedIn)</span>
                  </p>
                )}
                {myContact.profileUrl && (
                  <a
                    href={myContact.profileUrl}
                    target="_blank"
                    className="mt-1 inline-block text-brand-700 hover:underline"
                  >
                    View profile →
                  </a>
                )}
              </div>
            ) : degree != null ? (
              <p className="text-gray-700">
                {degreeLabel(degree)}-degree: reachable through {degree - 1} intro
                {degree - 1 === 1 ? "" : "s"} via mapped relationships and shared work history.
              </p>
            ) : (
              <p className="text-gray-500">
                No known path from your network yet — import your connections on the LinkedIn page.
              </p>
            )}
            {teamContacts.length > 0 && (
              <p className="mt-2 text-gray-700">
                Also connected to teammates:{" "}
                {teamContacts.map((c) => c.user.name).join(", ")}
              </p>
            )}
          </div>

          {person.positions.length > 0 && (
            <div className="card text-sm">
              <h2 className="mb-2 font-semibold">Role history</h2>
              <ul className="space-y-1.5">
                {person.positions.map((pos) => (
                  <li key={pos.id} className={pos.current ? "" : "text-gray-500"}>
                    {pos.title} · {pos.company.name}
                    {pos.current ? (
                      <span className="chip ml-2 bg-emerald-100 text-emerald-800">current</span>
                    ) : (
                      " (former)"
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {person.links.length > 0 && (
            <div className="card text-sm">
              <h2 className="mb-2 font-semibold">CRM links</h2>
              <ul className="space-y-1">
                {person.links.map((l) => (
                  <li key={l.id} className="text-gray-700">
                    {l.provider} {l.externalType} <code className="text-xs">{l.externalId}</code>
                    <span className="text-xs text-gray-400"> · {l.connection.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Facts — with citations, ancestry-style */}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Facts & intel
          </h2>
          <ul className="space-y-2">
            {person.facts.map((f) => (
              <li key={f.id} className="card py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {f.label}
                    </div>
                    <div className="text-sm">{f.value}</div>
                  </div>
                  <span className={`chip ${CONFIDENCE_CHIP[f.confidence]}`}>{f.confidence}</span>
                </div>
                <div className="mt-1.5 text-xs text-gray-500">
                  {f.source ? (
                    <>
                      Source: {f.source.url ? (
                        <a href={f.source.url} target="_blank" className="text-brand-700 hover:underline">
                          {f.source.title}
                        </a>
                      ) : (
                        f.source.title
                      )}{" "}
                      ({f.source.kind})
                    </>
                  ) : (
                    "No source cited"
                  )}
                  {f.author && <> · by {f.author.name}</>}
                </div>
              </li>
            ))}
            {person.facts.length === 0 && (
              <li className="text-sm text-gray-500">No facts recorded yet.</li>
            )}
          </ul>
          <div className="mt-3">
            <FactForm personId={person.id} />
          </div>
        </div>

        {/* Research gallery */}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Research & files
          </h2>
          <ul className="space-y-2">
            {person.artifacts.map((a) => (
              <li key={a.id} className="card py-2.5 text-sm">
                <span className="mr-1.5">
                  {a.kind === "file" ? "📎" : a.kind === "link" ? "🔗" : "📝"}
                </span>
                {a.url ? (
                  <a href={a.url} target="_blank" className="font-medium text-brand-700 hover:underline">
                    {a.title}
                  </a>
                ) : (
                  <span className="font-medium">{a.title}</span>
                )}
                {a.body && <p className="mt-1 whitespace-pre-wrap text-gray-700">{a.body}</p>}
                <div className="mt-1 text-xs text-gray-500">
                  {a.author?.name ?? "Unknown"} · {new Date(a.createdAt).toLocaleDateString()}
                  {a.sizeBytes ? ` · ${(a.sizeBytes / 1024).toFixed(0)} KB` : ""}
                </div>
              </li>
            ))}
            {person.artifacts.length === 0 && (
              <li className="text-sm text-gray-500">No research attached yet.</li>
            )}
          </ul>
          <div className="mt-3">
            <ArtifactForm personId={person.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
