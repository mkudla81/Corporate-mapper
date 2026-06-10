import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertPersonAccess, assertCompanyAccess } from "@/lib/authz";

const createSchema = z.object({
  personId: z.string(),
  companyId: z.string(),
  title: z.string().min(1),
  department: z.string().optional(),
  seniority: z.string().optional(),
});

// Adding a new current position retires the previous one — role history is
// preserved the way ancestry keeps superseded life events.
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = createSchema.parse(await req.json());
    const user = await requireApiUser();
    await assertPersonAccess(user, body.personId);
    await assertCompanyAccess(user, body.companyId);
    await db.position.updateMany({
      where: { personId: body.personId, current: true },
      data: { current: false, endDate: new Date() },
    });
    const position = await db.position.create({ data: { ...body, startDate: new Date() } });
    return NextResponse.json(position, { status: 201 });
  });
}
