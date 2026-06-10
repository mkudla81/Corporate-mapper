import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LinkedInImportForm } from "@/components/LinkedInImportForm";

export const dynamic = "force-dynamic";

export default async function LinkedInPage() {
  const user = await getCurrentUser();
  const contacts = await db.linkedInContact.findMany({
    where: { userId: user.id },
    orderBy: [{ personId: "desc" }, { lastName: "asc" }],
    include: { person: { include: { orgMap: { select: { id: true, name: true } } } } },
  });
  const matchedCount = contacts.filter((c) => c.personId).length;

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold">LinkedIn network</h1>
      <p className="mb-4 text-sm text-gray-600">
        Import your LinkedIn connections (Settings → Data privacy → Get a copy of your data →
        Connections) to overlay your 1st-degree network onto prospect org maps. Matched people get
        a degree-of-connection badge on every chart.
      </p>

      <LinkedInImportForm />

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Your connections ({contacts.length})
        </h2>
        <span className="text-xs text-gray-500">{matchedCount} matched to mapped people</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Company</th>
              <th className="py-2 pr-4">Position</th>
              <th className="py-2 pr-4">Connected</th>
              <th className="py-2">Mapped person</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium">
                  {c.profileUrl ? (
                    <a href={c.profileUrl} target="_blank" className="text-brand-700 hover:underline">
                      {c.firstName} {c.lastName}
                    </a>
                  ) : (
                    `${c.firstName} ${c.lastName}`
                  )}
                </td>
                <td className="py-2 pr-4">{c.company ?? "—"}</td>
                <td className="py-2 pr-4">{c.position ?? "—"}</td>
                <td className="py-2 pr-4 text-gray-500">
                  {c.connectedOn ? new Date(c.connectedOn).toLocaleDateString() : "—"}
                </td>
                <td className="py-2">
                  {c.person ? (
                    <Link href={`/people/${c.person.id}`} className="text-brand-700 hover:underline">
                      {c.person.firstName} {c.person.lastName}
                      <span className="text-xs text-gray-500"> · {c.person.orgMap.name}</span>
                    </Link>
                  ) : (
                    <span className="text-gray-400">not in any map</span>
                  )}
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  No connections imported yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
