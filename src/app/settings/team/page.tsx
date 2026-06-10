import { db } from "@/lib/db";
import { requireUser, currentWorkspaceId } from "@/lib/auth";
import { InviteForm } from "@/components/InviteForm";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();
  const workspaceId = currentWorkspaceId(user);
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      members: { include: { user: true }, orderBy: { user: { name: "asc" } } },
      invites: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        include: { inviter: true },
      },
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">{workspace.name}</h1>
      <p className="mb-6 text-sm text-gray-600">
        Everyone in this workspace shares its org maps, research, and CRM connections — that&apos;s
        the point: institutional knowledge that outlives any one rep.
      </p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Members</h2>
      <ul className="mb-6 space-y-2">
        {workspace.members.map((m) => (
          <li key={m.id} className="card flex items-center justify-between py-3 text-sm">
            <div>
              <span className="font-medium">{m.user.name}</span>
              <span className="ml-2 text-gray-500">{m.user.email}</span>
            </div>
            <span className="chip bg-gray-100 text-gray-600">{m.role}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Invite a teammate
      </h2>
      <InviteForm />

      {workspace.invites.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pending invites
          </h2>
          <ul className="space-y-2">
            {workspace.invites.map((i) => (
              <li key={i.id} className="card py-3 text-sm">
                <span className="font-medium">{i.email ?? "Anyone with the link"}</span>
                <span className="chip ml-2 bg-gray-100 text-gray-600">{i.role}</span>
                <div className="mt-1 text-xs text-gray-500">
                  Invited by {i.inviter.name} · expires {new Date(i.expiresAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
