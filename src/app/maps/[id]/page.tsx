import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, currentWorkspaceId, workspaceIds } from "@/lib/auth";
import { computeDegrees } from "@/lib/network";
import { MapWorkspace } from "@/components/MapWorkspace";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const map = await db.orgMap.findUnique({
    where: { id: params.id },
    include: {
      companies: true,
      people: {
        include: { positions: { where: { current: true }, include: { company: true } } },
      },
      edges: true,
      hints: { where: { status: "pending" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!map || !workspaceIds(user).includes(map.workspaceId)) notFound();

  const workspaceId = currentWorkspaceId(user);
  const connections = await db.crmConnection.findMany({
    where: { workspaceId },
    select: { id: true, provider: true, label: true },
  });

  const degrees = await computeDegrees(user.id, workspaceId);
  const people = map.people.map((p) => ({ ...p, degree: degrees.get(p.id) }));

  const activity = await db.activity.findMany({
    where: { orgMapId: map.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: true },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{map.name}</h1>
          {map.description && <p className="text-sm text-gray-600">{map.description}</p>}
        </div>
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← All maps
        </Link>
      </div>

      <MapWorkspace
        orgMapId={map.id}
        people={people}
        edges={map.edges}
        companies={map.companies}
        hints={map.hints}
        connections={connections}
      />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Map history
        </h2>
        <ul className="space-y-1">
          {activity.map((a) => (
            <li key={a.id} className="text-sm text-gray-700">
              <span className="text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>{" "}
              {a.user?.name ?? "System"} — {a.summary}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
