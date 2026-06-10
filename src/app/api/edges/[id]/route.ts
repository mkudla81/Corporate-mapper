import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertEdgeAccess } from "@/lib/authz";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    await assertEdgeAccess(user, params.id);
    await db.edge.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
