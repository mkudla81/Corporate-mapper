import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertMapAccess, assertCompanyAccess } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  orgMapId: z.string(),
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  parentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = createSchema.parse(await req.json());
    const user = await requireApiUser();
    await assertMapAccess(user, body.orgMapId);
    if (body.parentId) await assertCompanyAccess(user, body.parentId);
    const company = await db.company.create({ data: body });
    await logActivity({
      orgMapId: body.orgMapId,
      userId: user.id,
      verb: "created",
      entity: "company",
      entityId: company.id,
      summary: `Added company "${company.name}"`,
    });
    return NextResponse.json(company, { status: 201 });
  });
}
