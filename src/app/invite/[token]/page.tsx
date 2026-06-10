import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await db.invite.findUnique({
    where: { token: params.token },
    include: { workspace: true, inviter: true },
  });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  const user = await getCurrentUser();

  if (!valid) {
    return (
      <div className="mx-auto mt-16 max-w-sm text-center">
        <h1 className="text-xl font-semibold">Invite not valid</h1>
        <p className="mt-2 text-sm text-gray-600">
          This invite link has expired or was already used. Ask your teammate for a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-16 max-w-sm text-center">
      <h1 className="text-xl font-semibold">Join {invite.workspace.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {invite.inviter.name} invited you to collaborate on prospect org maps.
      </p>
      <div className="mt-6">
        {user ? (
          <AcceptInviteButton token={params.token} />
        ) : (
          <div className="space-y-2">
            <Link href={`/signup?invite=${params.token}`} className="btn-primary w-full justify-center">
              Create an account to join
            </Link>
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-brand-700 hover:underline">
                Sign in
              </Link>{" "}
              first, then reopen this link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
