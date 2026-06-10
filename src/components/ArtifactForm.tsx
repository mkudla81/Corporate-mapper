"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ArtifactForm({ personId, companyId }: { personId?: string; companyId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "file" | "link" | "note">("closed");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setMode("closed");
    setTitle("");
    setUrl("");
    setBody("");
    setFile(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let res: Response;
    if (mode === "file") {
      if (!file) return;
      const form = new FormData();
      form.set("file", file);
      if (title) form.set("title", title);
      if (personId) form.set("personId", personId);
      if (companyId) form.set("companyId", companyId);
      res = await fetch("/api/artifacts", { method: "POST", body: form });
    } else {
      res = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: mode,
          title,
          url: mode === "link" ? url : undefined,
          body: mode === "note" ? body : undefined,
          personId,
          companyId,
        }),
      });
    }
    setBusy(false);
    if (res.ok) {
      reset();
      router.refresh();
    }
  }

  if (mode === "closed") {
    return (
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={() => setMode("file")}>
          📎 Upload file
        </button>
        <button className="btn-secondary" onClick={() => setMode("link")}>
          🔗 Add link
        </button>
        <button className="btn-secondary" onClick={() => setMode("note")}>
          📝 Add note
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-2.5">
      {mode === "file" && (
        <div>
          <label className="label">File</label>
          <input
            type="file"
            className="text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
      )}
      <div>
        <label className="label">Title</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={mode === "file" ? "(defaults to file name)" : "Title"}
          required={mode !== "file"}
        />
      </div>
      {mode === "link" && (
        <div>
          <label className="label">URL</label>
          <input
            className="input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            required
          />
        </div>
      )}
      {mode === "note" && (
        <div>
          <label className="label">Note</label>
          <textarea
            className="input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={reset}>
          Cancel
        </button>
      </div>
    </form>
  );
}
