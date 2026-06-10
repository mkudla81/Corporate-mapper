import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertPersonAccess } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    await assertPersonAccess(user, params.id);
    const person = await db.person.findUnique({
      where: { id: params.id },
      include: {
        positions: { include: { company: true }, orderBy: { current: "desc" } },
        facts: { include: { source: true, author: true }, orderBy: { createdAt: "desc" } },
        artifacts: { include: { author: true }, orderBy: { createdAt: "desc" } },
        links: true,
        edgesFrom: { include: { to: true } },
        edgesTo: { include: { from: true } },
        orgMap: true,
      },
    });
    return NextResponse.json(person);
  });
}

const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  disposition: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const body = patchSchema.parse(await req.json());
    const user = await requireApiUser();
    await assertPersonAccess(user, params.id);
    const person = await db.person.update({ where: { id: params.id }, data: body });
    await logActivity({
      orgMapId: person.orgMapId,
      userId: user.id,
      verb: "updated",
      entity: "person",
      entityId: person.id,
      summary: `Updated ${person.firstName} ${person.lastName} (${Object.keys(body).join(", ")})`,
    });
    return NextResponse.json(person);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    await assertPersonAccess(user, params.id);
    const person = await db.person.delete({ where: { id: params.id } });
    await logActivity({
      orgMapId: person.orgMapId,
      userId: user.id,
      verb: "deleted",
      entity: "person",
      entityId: person.id,
      summary: `Removed ${person.firstName} ${person.lastName}`,
    });
    return NextResponse.json({ ok: true });
  });
}
