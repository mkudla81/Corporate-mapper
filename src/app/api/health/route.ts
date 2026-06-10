import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Liveness/readiness probe for deploy platforms and uptime checks.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
