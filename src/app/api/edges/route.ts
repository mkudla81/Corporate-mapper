import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertMapAccess, assertPersonAccess } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  orgMapId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  type: z.enum([
    "REPORTS_TO",
    "DOTTED_LINE",
    "INFLUENCES",
    "ALLY_OF",
    "CONFLICT_WITH",
    "FORMER_COLLEAGUE",
    "MENTOR_OF",
  ]),
  strength: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = createSchema.parse(await req.json());
    if (body.fromId === body.toId) {
      return NextResponse.json({ error: "Cannot link a person to themselves" }, { status: 400 });
    }
    const user = await requireApiUser();
    await assertMapAccess(user, body.orgMapId);
    await assertPersonAccess(user, body.fromId);
    await assertPersonAccess(user, body.toId);
    const edge = await db.edge.upsert({
      where: { fromId_toId_type: { fromId: body.fromId, toId: body.toId, type: body.type } },
      create: body,
      update: { strength: body.strength, notes: body.notes },
      include: { from: true, to: true },
    });
    await logActivity({
      orgMapId: body.orgMapId,
      userId: user.id,
      verb: "linked",
      entity: "edge",
      entityId: edge.id,
      summary: `${edge.from.firstName} ${edge.from.lastName} —${body.type}→ ${edge.to.firstName} ${edge.to.lastName}`,
    });
    return NextResponse.json(edge, { status: 201 });
  });
}
