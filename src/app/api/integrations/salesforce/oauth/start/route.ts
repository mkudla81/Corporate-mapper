import { NextResponse } from "next/server";
import crypto from "crypto";
import { salesforceAuthUrl } from "@/lib/crm/salesforce";

export async function GET() {
  if (!process.env.SFDC_CLIENT_ID) {
    return NextResponse.json(
      { error: "Set SFDC_CLIENT_ID / SFDC_CLIENT_SECRET in .env to use Salesforce OAuth." },
      { status: 400 }
    );
  }
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(salesforceAuthUrl(state));
  res.cookies.set("sfdc_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
