import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ personId: z.string().nullable() });

// Manually link/unlink an imported LinkedIn contact to a Person.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { personId } = schema.parse(await req.json());
  const contact = await db.linkedInContact.update({
    where: { id: params.id },
    data: { personId },
  });
  return NextResponse.json(contact);
}
