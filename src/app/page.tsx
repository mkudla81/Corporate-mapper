import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { NewMapForm } from "@/components/NewMapForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const maps = await db.orgMap.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          people: true,
          companies: true,
          hints: { where: { status: "pending" } },
        },
      },
    },
  });
  const recent = await db.activity.findMany({
    where: { orgMap: { workspaceId } },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { user: true, orgMap: true },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Prospect Org Maps</h1>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {maps.map((map) => (
            <Link key={map.id} href={`/maps/${map.id}`} className="card hover:border-brand-500">
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-brand-700">{map.name}</h2>
                {map._count.hints > 0 && (
                  <span className="chip bg-amber-100 text-amber-800">
                    🍃 {map._count.hints} hint{map._count.hints === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {map.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{map.description}</p>
              )}
              <p className="mt-3 text-xs text-gray-500">
                {map._count.people} people · {map._count.companies} companies · updated{" "}
                {new Date(map.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
          {maps.length === 0 && (
            <p className="col-span-2 text-sm text-gray-500">
              No org maps yet — create your first prospect map.
            </p>
          )}
        </div>
        <div className="mt-6">
          <NewMapForm />
        </div>
      </div>

      <aside>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Team activity
        </h2>
        <ul className="space-y-2">
          {recent.map((a) => (
            <li key={a.id} className="card py-2.5 text-sm">
              <span className="text-gray-800">{a.summary}</span>
              <div className="mt-0.5 text-xs text-gray-500">
                {a.user?.name ?? "System"} · {a.orgMap.name} ·{" "}
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {recent.length === 0 && <li className="text-sm text-gray-500">Nothing yet.</li>}
        </ul>
      </aside>
    </div>
  );
}
