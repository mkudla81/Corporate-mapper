import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertHintAccess } from "@/lib/authz";
import { acceptHint, dismissHint } from "@/lib/crm/sync";

const schema = z.object({ action: z.enum(["accept", "dismiss"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { action } = schema.parse(await req.json());
    const user = await requireApiUser();
    await assertHintAccess(user, params.id);
    if (action === "accept") {
      await acceptHint(params.id, user.id);
    } else {
      await dismissHint(params.id);
    }
    return NextResponse.json({ ok: true });
  });
}
