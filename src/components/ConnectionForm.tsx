"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectionForm() {
  const router = useRouter();
  const [provider, setProvider] = useState<"hubspot" | "salesforce">("hubspot");
  const [label, setLabel] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        label: label || (provider === "hubspot" ? "HubSpot" : "Salesforce"),
        accessToken,
        instanceUrl: instanceUrl || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setLabel("");
      setAccessToken("");
      setInstanceUrl("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create connection");
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-lg space-y-3">
      <div>
        <label className="label">Provider</label>
        <select
          className="input"
          value={provider}
          onChange={(e) => setProvider(e.target.value as "hubspot" | "salesforce")}
        >
          <option value="hubspot">HubSpot (Private App token)</option>
          <option value="salesforce">Salesforce (access token)</option>
        </select>
      </div>
      <div>
        <label className="label">Label</label>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Production HubSpot"
        />
      </div>
      <div>
        <label className="label">Access token</label>
        <input
          className="input"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          required
        />
      </div>
      {provider === "salesforce" && (
        <div>
          <label className="label">Instance URL</label>
          <input
            className="input"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            placeholder="https://yourorg.my.salesforce.com"
            required
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Connecting…" : "Add connection"}
      </button>
    </form>
  );
}
