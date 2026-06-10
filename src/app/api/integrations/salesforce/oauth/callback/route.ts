import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, currentWorkspaceId } from "@/lib/auth";
import { encryptSecret } from "@/lib/secrets";
import { salesforceExchangeCode } from "@/lib/crm/salesforce";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("sfdc_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const tokens = await salesforceExchangeCode(code);
  await db.crmConnection.create({
    data: {
      workspaceId: currentWorkspaceId(user),
      provider: "salesforce",
      label: "Salesforce",
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
      instanceUrl: tokens.instance_url,
    },
  });
  return NextResponse.redirect(new URL("/settings/integrations", process.env.APP_BASE_URL));
}
