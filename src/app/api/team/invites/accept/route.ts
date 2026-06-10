import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";

const schema = z.object({ token: z.string().min(1) });

// Logged-in user joins the invite's workspace.
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { token } = schema.parse(await req.json());
    const user = await requireApiUser();
    const invite = await db.invite.findUnique({ where: { token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 });
    }
    if (invite.email && invite.email !== user.email) {
      return NextResponse.json({ error: "This invite is for a different email address" }, { status: 400 });
    }
    const already = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
    });
    if (!already) {
      await db.membership.create({
        data: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
      });
    }
    await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
