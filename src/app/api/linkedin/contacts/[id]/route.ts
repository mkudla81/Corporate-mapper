import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertPersonAccess, ForbiddenError } from "@/lib/authz";

const schema = z.object({ personId: z.string().nullable() });

// Manually link/unlink an imported LinkedIn contact to a Person. Contacts are
// personal: only their owner may modify them.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { personId } = schema.parse(await req.json());
    const user = await requireApiUser();
    const existing = await db.linkedInContact.findUnique({ where: { id: params.id } });
    if (!existing || existing.userId !== user.id) throw new ForbiddenError();
    if (personId) await assertPersonAccess(user, personId);
    const contact = await db.linkedInContact.update({
      where: { id: params.id },
      data: { personId },
    });
    return NextResponse.json(contact);
  });
}
