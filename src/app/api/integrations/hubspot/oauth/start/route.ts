import { NextResponse } from "next/server";
import crypto from "crypto";
import { hubspotAuthUrl } from "@/lib/crm/hubspot";

export async function GET() {
  if (!process.env.HUBSPOT_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "Set HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET in .env, or create a connection with a Private App token instead.",
      },
      { status: 400 }
    );
  }
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(hubspotAuthUrl(state));
  res.cookies.set("hubspot_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
