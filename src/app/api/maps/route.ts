import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser, currentWorkspaceId } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    const maps = await db.orgMap.findMany({
      where: { workspaceId: currentWorkspaceId(user) },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { people: true, companies: true, hints: { where: { status: "pending" } } },
        },
      },
    });
    return NextResponse.json(maps);
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  companyName: z.string().optional(), // convenience: seed the root company
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = createSchema.parse(await req.json());
    const user = await requireApiUser();

    const map = await db.orgMap.create({
      data: { name: body.name, description: body.description, workspaceId: currentWorkspaceId(user) },
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
  });
}
