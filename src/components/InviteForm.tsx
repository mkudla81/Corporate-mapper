"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInviteUrl(null);
    const res = await fetch("/api/team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email || undefined, role }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(data.url);
      setEmail("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label">Email (optional — restricts who can use the link)</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create invite link"}
      </button>
      {inviteUrl && (
        <div className="flex items-center gap-2 rounded-md bg-brand-50 p-2">
          <code className="flex-1 truncate text-xs text-brand-700">{inviteUrl}</code>
          <button
            type="button"
            className="btn-secondary !px-2 !py-1 text-xs"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </form>
  );
}
