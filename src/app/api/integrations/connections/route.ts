import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentWorkspaceId } from "@/lib/auth";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  const connections = await db.crmConnection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      provider: true,
      label: true,
      instanceUrl: true,
      createdAt: true,
      lastSyncAt: true,
      // tokens intentionally excluded from API responses
    },
  });
  return NextResponse.json(connections);
}

// Manual connection creation — the quick path for HubSpot private-app tokens
// or pre-issued Salesforce tokens. The OAuth routes create connections too.
const createSchema = z.object({
  provider: z.enum(["salesforce", "hubspot"]),
  label: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  instanceUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = createSchema.parse(await req.json());
  const workspaceId = await getCurrentWorkspaceId();
  if (body.provider === "salesforce" && !body.instanceUrl) {
    return NextResponse.json(
      { error: "instanceUrl is required for Salesforce connections" },
      { status: 400 }
    );
  }
  const conn = await db.crmConnection.create({
    data: { ...body, workspaceId },
    select: { id: true, provider: true, label: true, createdAt: true },
  });
  return NextResponse.json(conn, { status: 201 });
}
