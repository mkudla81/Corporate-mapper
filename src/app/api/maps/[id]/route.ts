import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertMapAccess } from "@/lib/authz";

// Full map payload: companies, people (with current positions), edges —
// everything the org chart needs in one round trip.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    await assertMapAccess(user, params.id);
    const map = await db.orgMap.findUnique({
      where: { id: params.id },
      include: {
        companies: { include: { children: true } },
        people: {
          include: {
            positions: { where: { current: true }, include: { company: true } },
            facts: { include: { source: true } },
          },
        },
        edges: true,
        hints: { where: { status: "pending" } },
      },
    });
    return NextResponse.json(map);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    await assertMapAccess(user, params.id);
    await db.orgMap.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
