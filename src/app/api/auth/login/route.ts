import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = schema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    // Same error for unknown email and wrong password — don't leak which.
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const session = await createSession(user.id);
    const res = NextResponse.json({ id: user.id, name: user.name, email: user.email });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  });
}
