import { db } from "./db";

// Every meaningful change lands in the Activity feed — the platform's
// equivalent of ancestry's "tree changes" history.
export async function logActivity(args: {
  orgMapId: string;
  userId?: string | null;
  verb: string;
  entity: string;
  entityId?: string | null;
  summary: string;
}) {
  await db.activity.create({
    data: {
      orgMapId: args.orgMapId,
      userId: args.userId ?? null,
      verb: args.verb,
      entity: args.entity,
      entityId: args.entityId ?? null,
      summary: args.summary,
    },
  });
}
