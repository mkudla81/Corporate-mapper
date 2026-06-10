import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { withApiErrors, assertPersonAccess, assertCompanyAccess } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { saveFile } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Two content types:
//   multipart/form-data → file upload (fields: file, title?, personId?, companyId?)
//   application/json    → link or note artifact
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const user = await requireApiUser();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file field required" }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
      }
      const personId = (form.get("personId") as string) || undefined;
      const companyId = (form.get("companyId") as string) || undefined;
      if (personId) await assertPersonAccess(user, personId);
      if (companyId) await assertCompanyAccess(user, companyId);
      const title = (form.get("title") as string) || file.name;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { storedName } = await saveFile(file.name, buffer);

      const artifact = await db.artifact.create({
        data: {
          kind: "file",
          title,
          storedName,
          url: `/api/files/${storedName}`,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: buffer.length,
          personId,
          companyId,
          createdBy: user.id,
        },
        include: { person: true, company: true },
      });
      await logArtifact(artifact, user.id, "uploaded");
      return NextResponse.json(artifact, { status: 201 });
    }

    const schema = z.object({
      kind: z.enum(["link", "note"]),
      title: z.string().min(1),
      url: z.string().optional(),
      body: z.string().optional(),
      personId: z.string().optional(),
      companyId: z.string().optional(),
    });
    const data = schema.parse(await req.json());
    if (data.personId) await assertPersonAccess(user, data.personId);
    if (data.companyId) await assertCompanyAccess(user, data.companyId);
    const artifact = await db.artifact.create({
      data: { ...data, createdBy: user.id },
      include: { person: true, company: true },
    });
    await logArtifact(artifact, user.id, "created");
    return NextResponse.json(artifact, { status: 201 });
  });
}

async function logArtifact(
  artifact: {
    id: string;
    kind: string;
    title: string;
    person: { orgMapId: string; firstName: string; lastName: string } | null;
    company: { orgMapId: string; name: string } | null;
  },
  userId: string,
  verb: string
) {
  const orgMapId = artifact.person?.orgMapId ?? artifact.company?.orgMapId;
  if (!orgMapId) return;
  const target = artifact.person
    ? `${artifact.person.firstName} ${artifact.person.lastName}`
    : artifact.company?.name;
  await logActivity({
    orgMapId,
    userId,
    verb,
    entity: "artifact",
    entityId: artifact.id,
    summary: `${verb === "uploaded" ? "Uploaded" : "Added"} ${artifact.kind} "${artifact.title}" on ${target}`,
  });
}
