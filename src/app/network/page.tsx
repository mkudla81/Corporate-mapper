import { requireUser, currentWorkspaceId } from "@/lib/auth";
import { buildOrgNetwork } from "@/lib/network";
import { OrgNetwork } from "@/components/OrgNetwork";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const user = await requireUser();
  const workspaceId = currentWorkspaceId(user);
  const { nodes, bridges } = await buildOrgNetwork(user.id, workspaceId);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Network view</h1>
      <p className="mb-4 text-sm text-gray-600">
        All target organizations across your maps. <span className="text-violet-600">Dashed
        purple</span> bridges are shared work history (someone has held roles at both orgs);{" "}
        <span className="text-sky-600">blue</span> bridges are mapped relationships crossing org
        boundaries; <span className="text-emerald-600">green</span> edges are your own 1st-degree
        LinkedIn paths in. Click an org to open its map.
      </p>
      {nodes.length === 0 ? (
        <p className="text-sm text-gray-500">No organizations mapped yet.</p>
      ) : (
        <OrgNetwork orgs={nodes} bridges={bridges} />
      )}
    </div>
  );
}
