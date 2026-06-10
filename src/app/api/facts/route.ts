import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  confidence: z.enum(["verified", "likely", "unverified"]).optional(),
  personId: z.string().optional(),
  companyId: z.string().optional(),
  // inline source citation
  source: z
    .object({
      kind: z.enum(["salesforce", "hubspot", "linkedin", "call_note", "email", "web", "manual"]),
      title: z.string().min(1),
      url: z.string().optional(),
      detail: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const body = createSchema.parse(await req.json());
  if (!body.personId && !body.companyId) {
    return NextResponse.json({ error: "personId or companyId required" }, { status: 400 });
  }
  const user = await getCurrentUser();

  let sourceId: string | undefined;
  if (body.source) {
    const source = await db.source.create({ data: body.source });
    sourceId = source.id;
  }

  const fact = await db.fact.create({
    data: {
      label: body.label,
      value: body.value,
      confidence: body.confidence ?? "unverified",
      personId: body.personId,
      companyId: body.companyId,
      sourceId,
      createdBy: user.id,
    },
    include: { source: true, person: true, company: true },
  });

  const orgMapId = fact.person?.orgMapId ?? fact.company?.orgMapId;
  if (orgMapId) {
    await logActivity({
      orgMapId,
      userId: user.id,
      verb: "created",
      entity: "fact",
      entityId: fact.id,
      summary: `Added fact "${fact.label}" ${fact.person ? `on ${fact.person.firstName} ${fact.person.lastName}` : `on ${fact.company?.name}`}`,
    });
  }

  return NextResponse.json(fact, { status: 201 });
}
