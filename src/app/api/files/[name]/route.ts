import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser, workspaceIds } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";
import { loadFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    const artifact = await db.artifact.findFirst({
      where: { storedName: params.name },
      include: {
        person: { select: { orgMap: { select: { workspaceId: true } } } },
        company: { select: { orgMap: { select: { workspaceId: true } } } },
      },
    });
    if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const wsId =
      artifact.person?.orgMap.workspaceId ?? artifact.company?.orgMap.workspaceId ?? null;
    if (wsId && !workspaceIds(user).includes(wsId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const data = await loadFile(params.name);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": artifact.mimeType ?? "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(artifact.title)}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
    }
  });
}
