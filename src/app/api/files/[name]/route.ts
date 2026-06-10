import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const artifact = await db.artifact.findFirst({ where: { storedName: params.name } });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
}
