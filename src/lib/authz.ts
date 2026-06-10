import { NextResponse } from "next/server";
import { db } from "./db";
import { CurrentUser, UnauthorizedError, workspaceIds } from "./auth";

// Workspace-scoped access checks for API routes. Every mutation route must
// verify the target entity belongs to one of the caller's workspaces before
// touching it.

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
  }
}

export async function assertMapAccess(user: CurrentUser, orgMapId: string) {
  const map = await db.orgMap.findUnique({ where: { id: orgMapId }, select: { workspaceId: true } });
  if (!map || !workspaceIds(user).includes(map.workspaceId)) throw new ForbiddenError();
}

export async function assertPersonAccess(user: CurrentUser, personId: string) {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: { orgMap: { select: { workspaceId: true } } },
  });
  if (!person || !workspaceIds(user).includes(person.orgMap.workspaceId)) {
    throw new ForbiddenError();
  }
}

export async function assertCompanyAccess(user: CurrentUser, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { orgMap: { select: { workspaceId: true } } },
  });
  if (!company || !workspaceIds(user).includes(company.orgMap.workspaceId)) {
    throw new ForbiddenError();
  }
}

export async function assertEdgeAccess(user: CurrentUser, edgeId: string) {
  const edge = await db.edge.findUnique({
    where: { id: edgeId },
    select: { orgMap: { select: { workspaceId: true } } },
  });
  if (!edge || !workspaceIds(user).includes(edge.orgMap.workspaceId)) throw new ForbiddenError();
}

export async function assertHintAccess(user: CurrentUser, hintId: string) {
  const hint = await db.hint.findUnique({
    where: { id: hintId },
    select: { orgMap: { select: { workspaceId: true } } },
  });
  if (!hint || !workspaceIds(user).includes(hint.orgMap.workspaceId)) throw new ForbiddenError();
}

export async function assertConnectionAccess(user: CurrentUser, connectionId: string) {
  const conn = await db.crmConnection.findUnique({
    where: { id: connectionId },
    select: { workspaceId: true },
  });
  if (!conn || !workspaceIds(user).includes(conn.workspaceId)) throw new ForbiddenError();
}

// Uniform error → response mapping so route handlers can simply wrap their
// body in withApiErrors().
export async function withApiErrors(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err && typeof err === "object" && "issues" in err) {
      // zod validation error
      return NextResponse.json({ error: "Invalid request", details: (err as any).issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
