import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { db } from "./db";

export const SESSION_COOKIE = "cm_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
}

// Returns the logged-in user (with memberships) or null.
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { memberships: { include: { workspace: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// For server components/pages: redirect to login when unauthenticated.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// For API routes: throw a typed error the route converts to a 401.
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function workspaceIds(user: CurrentUser): string[] {
  return user.memberships.map((m) => m.workspaceId);
}

// The user's active workspace (first membership). Multi-workspace switching
// can layer on top of this without touching callers.
export function currentWorkspaceId(user: CurrentUser): string {
  const id = user.memberships[0]?.workspaceId;
  if (!id) throw new Error("User has no workspace");
  return id;
}
