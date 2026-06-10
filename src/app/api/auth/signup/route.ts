import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  inviteToken: z.string().optional(), // join an existing workspace instead of creating one
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    let workspaceId: string | null = null;
    let role = "owner";
    if (body.inviteToken) {
      const invite = await db.invite.findUnique({ where: { token: body.inviteToken } });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 });
      }
      if (invite.email && invite.email.toLowerCase() !== email) {
        return NextResponse.json({ error: "This invite is for a different email address" }, { status: 400 });
      }
      workspaceId = invite.workspaceId;
      role = invite.role;
      await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    }

    const user = await db.user.create({
      data: { name: body.name, email, passwordHash: hashPassword(body.password) },
    });

    if (!workspaceId) {
      const workspace = await db.workspace.create({ data: { name: `${body.name}'s team` } });
      workspaceId = workspace.id;
    }
    await db.membership.create({ data: { userId: user.id, workspaceId, role } });

    const session = await createSession(user.id);
    const res = NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  });
}
