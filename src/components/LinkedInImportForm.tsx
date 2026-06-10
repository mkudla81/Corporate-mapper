"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LinkedInImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/linkedin/import", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setResult(`Imported ${data.imported} connections — ${data.matched} matched to mapped people.`);
      setFile(null);
      router.refresh();
    } else {
      setResult(data.error ?? "Import failed");
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Connections.csv</label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={!file || busy}>
        {busy ? "Importing…" : "Import connections"}
      </button>
      {result && <p className="w-full text-sm text-gray-700">{result}</p>}
    </form>
  );
}
