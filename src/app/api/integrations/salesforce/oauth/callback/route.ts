import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { salesforceExchangeCode } from "@/lib/crm/salesforce";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("sfdc_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const tokens = await salesforceExchangeCode(code);
  const workspaceId = await getCurrentWorkspaceId();
  await db.crmConnection.create({
    data: {
      workspaceId,
      provider: "salesforce",
      label: "Salesforce",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      instanceUrl: tokens.instance_url,
    },
  });
  return NextResponse.redirect(new URL("/settings/integrations", process.env.APP_BASE_URL));
}
