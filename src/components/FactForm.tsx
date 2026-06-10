"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SOURCE_KINDS = ["call_note", "email", "linkedin", "web", "manual"] as const;

export function FactForm({ personId, companyId }: { personId?: string; companyId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState("unverified");
  const [sourceKind, setSourceKind] = useState<string>("call_note");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        value,
        confidence,
        personId,
        companyId,
        source: sourceTitle
          ? { kind: sourceKind, title: sourceTitle, url: sourceUrl || undefined }
          : undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setLabel("");
      setValue("");
      setSourceTitle("");
      setSourceUrl("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        + Add fact
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-2.5">
      <div>
        <label className="label">Fact</label>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Budget authority"
          required
        />
      </div>
      <div>
        <label className="label">Detail</label>
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Owns the $2M infrastructure budget"
          required
        />
      </div>
      <div>
        <label className="label">Confidence</label>
        <select className="input" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
          <option value="verified">verified</option>
          <option value="likely">likely</option>
          <option value="unverified">unverified</option>
        </select>
      </div>
      <fieldset className="rounded-md border border-dashed border-gray-300 p-2.5">
        <legend className="px-1 text-xs text-gray-500">Citation (optional)</legend>
        <div className="space-y-2">
          <select className="input" value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}>
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="Discovery call 2026-06-02"
          />
          <input
            className="input"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https:// (optional)"
          />
        </div>
      </fieldset>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save fact"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
