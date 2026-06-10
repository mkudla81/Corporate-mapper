import { db } from "./db";

// Single-user demo auth: every request acts as the seeded demo user in the
// demo workspace. Replace with NextAuth/Clerk/etc. for real deployments —
// everything downstream only depends on this function's shape.
export async function getCurrentUser() {
  const user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    include: { memberships: true },
  });
  if (!user) throw new Error("No user found — run `npm run db:seed` first.");
  return user;
}

export async function getCurrentWorkspaceId() {
  const user = await getCurrentUser();
  const membership = user.memberships[0];
  if (!membership) throw new Error("Current user has no workspace.");
  return membership.workspaceId;
}
