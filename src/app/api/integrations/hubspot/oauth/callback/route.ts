import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { hubspotExchangeCode } from "@/lib/crm/hubspot";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("hubspot_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const tokens = await hubspotExchangeCode(code);
  const workspaceId = await getCurrentWorkspaceId();
  await db.crmConnection.create({
    data: {
      workspaceId,
      provider: "hubspot",
      label: "HubSpot",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return NextResponse.redirect(new URL("/settings/integrations", process.env.APP_BASE_URL));
}
