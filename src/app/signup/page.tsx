import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { invite?: string };
}) {
  if (await getCurrentUser()) redirect("/");

  let workspaceName: string | undefined;
  if (searchParams.invite) {
    const invite = await db.invite.findUnique({
      where: { token: searchParams.invite },
      include: { workspace: true },
    });
    if (invite && !invite.acceptedAt && invite.expiresAt > new Date()) {
      workspaceName = invite.workspace.name;
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-4 text-center text-xl font-semibold">Create your account</h1>
      <SignupForm inviteToken={searchParams.invite} workspaceName={workspaceName} />
    </div>
  );
}
