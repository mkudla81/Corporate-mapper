import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, getCurrentWorkspaceId } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  const maps = await db.orgMap.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { people: true, companies: true, hints: { where: { status: "pending" } } } } },
  });
  return NextResponse.json(maps);
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  companyName: z.string().optional(), // convenience: seed the root company
});

export async function POST(req: NextRequest) {
  const body = createSchema.parse(await req.json());
  const user = await getCurrentUser();
  const workspaceId = await getCurrentWorkspaceId();

  const map = await db.orgMap.create({
    data: { name: body.name, description: body.description, workspaceId },
  });
  if (body.companyName) {
    await db.company.create({ data: { orgMapId: map.id, name: body.companyName } });
  }
  await logActivity({
    orgMapId: map.id,
    userId: user.id,
    verb: "created",
    entity: "map",
    entityId: map.id,
    summary: `Created org map "${map.name}"`,
  });
  return NextResponse.json(map, { status: 201 });
}
