import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser, currentWorkspaceId } from "@/lib/auth";
import { withApiErrors } from "@/lib/authz";
import { encryptSecret } from "@/lib/secrets";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    const connections = await db.crmConnection.findMany({
      where: { workspaceId: currentWorkspaceId(user) },
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
  });
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
  return withApiErrors(async () => {
    const body = createSchema.parse(await req.json());
    const user = await requireApiUser();
    if (body.provider === "salesforce" && !body.instanceUrl) {
      return NextResponse.json(
        { error: "instanceUrl is required for Salesforce connections" },
        { status: 400 }
      );
    }
    const conn = await db.crmConnection.create({
      data: {
        ...body,
        accessToken: encryptSecret(body.accessToken),
        refreshToken: body.refreshToken ? encryptSecret(body.refreshToken) : undefined,
        workspaceId: currentWorkspaceId(user),
      },
      select: { id: true, provider: true, label: true, createdAt: true },
    });
    return NextResponse.json(conn, { status: 201 });
  });
}
