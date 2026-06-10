import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  orgMapId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  disposition: z.string().optional(),
  notes: z.string().optional(),
  // optional initial position
  companyId: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  seniority: z.string().optional(),
  // optional manager to wire a REPORTS_TO edge immediately
  managerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = createSchema.parse(await req.json());
  const user = await getCurrentUser();

  const person = await db.person.create({
    data: {
      orgMapId: body.orgMapId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone,
      linkedin: body.linkedin,
      disposition: body.disposition ?? "unknown",
      notes: body.notes,
    },
  });

  if (body.companyId && body.title) {
    await db.position.create({
      data: {
        personId: person.id,
        companyId: body.companyId,
        title: body.title,
        department: body.department,
        seniority: body.seniority,
      },
    });
  }

  if (body.managerId) {
    await db.edge.create({
      data: {
        orgMapId: body.orgMapId,
        fromId: person.id,
        toId: body.managerId,
        type: "REPORTS_TO",
      },
    });
  }

  await logActivity({
    orgMapId: body.orgMapId,
    userId: user.id,
    verb: "created",
    entity: "person",
    entityId: person.id,
    summary: `Added ${person.firstName} ${person.lastName}${body.title ? ` (${body.title})` : ""}`,
  });

  return NextResponse.json(person, { status: 201 });
}
