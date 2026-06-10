import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, currentWorkspaceId } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";
import { importConnections } from "@/lib/linkedin";

// Upload a LinkedIn data-export Connections.csv (multipart, field "file").
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }
    const text = await file.text();
    try {
      const result = await importConnections(user.id, currentWorkspaceId(user), text);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Import failed" },
        { status: 400 }
      );
    }
  });
}
