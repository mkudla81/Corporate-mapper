import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
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
  const body = patchSchema.parse(await req.json());
  const user = await getCurrentUser();
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
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
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
}
