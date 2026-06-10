import { db } from "@/lib/db";
import { requireUser, currentWorkspaceId } from "@/lib/auth";
import { ConnectionForm } from "@/components/ConnectionForm";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requireUser();
  const workspaceId = currentWorkspaceId(user);
  const connections = await db.crmConnection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, provider: true, label: true, instanceUrl: true, createdAt: true, lastSyncAt: true },
  });

  const sfdcOauthReady = Boolean(process.env.SFDC_CLIENT_ID);
  const hubspotOauthReady = Boolean(process.env.HUBSPOT_CLIENT_ID);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Integrations</h1>
      <p className="mb-6 text-sm text-gray-600">
        Connect Salesforce and HubSpot to pull accounts and contacts into your org maps as hints,
        and keep records linked for future syncs.
      </p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Connected
      </h2>
      <ul className="mb-6 space-y-2">
        {connections.map((c) => (
          <li key={c.id} className="card flex items-center justify-between py-3 text-sm">
            <div>
              <span className="font-medium">{c.label}</span>{" "}
              <span className="chip ml-1 bg-gray-100 text-gray-600">{c.provider}</span>
              {c.instanceUrl && <div className="text-xs text-gray-500">{c.instanceUrl}</div>}
            </div>
            <div className="text-xs text-gray-500">
              {c.lastSyncAt
                ? `Last sync ${new Date(c.lastSyncAt).toLocaleString()}`
                : "Never synced"}
            </div>
          </li>
        ))}
        {connections.length === 0 && <li className="text-sm text-gray-500">No connections yet.</li>}
      </ul>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Add a connection
      </h2>
      <div className="mb-4 flex gap-2">
        <a
          href="/api/integrations/salesforce/oauth/start"
          className={`btn-secondary ${sfdcOauthReady ? "" : "pointer-events-none opacity-50"}`}
        >
          Connect Salesforce (OAuth)
        </a>
        <a
          href="/api/integrations/hubspot/oauth/start"
          className={`btn-secondary ${hubspotOauthReady ? "" : "pointer-events-none opacity-50"}`}
        >
          Connect HubSpot (OAuth)
        </a>
      </div>
      {(!sfdcOauthReady || !hubspotOauthReady) && (
        <p className="mb-4 text-xs text-gray-500">
          OAuth buttons are disabled until client credentials are set in <code>.env</code>. You can
          also connect directly with a token below (e.g. a HubSpot Private App token).
        </p>
      )}
      <ConnectionForm />
    </div>
  );
}
