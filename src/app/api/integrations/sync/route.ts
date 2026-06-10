import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runSync } from "@/lib/crm/sync";

const schema = z.object({
  connectionId: z.string(),
  orgMapId: z.string(),
  accountQuery: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  const user = await getCurrentUser();
  try {
    const result = await runSync({ ...body, userId: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
