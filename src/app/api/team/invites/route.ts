import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireApiUser, currentWorkspaceId } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";

const INVITE_DAYS = 14;

const schema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = schema.parse(await req.json().catch(() => ({})));
    const user = await requireApiUser();
    const invite = await db.invite.create({
      data: {
        token: crypto.randomBytes(24).toString("hex"),
        workspaceId: currentWorkspaceId(user),
        email: body.email?.toLowerCase(),
        role: body.role,
        createdBy: user.id,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const base = process.env.APP_BASE_URL ?? "";
    return NextResponse.json(
      { id: invite.id, url: `${base}/invite/${invite.token}`, expiresAt: invite.expiresAt },
      { status: 201 }
    );
  });
}
