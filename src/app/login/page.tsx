import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-4 text-center text-xl font-semibold">Sign in to Corporate Mapper</h1>
      <LoginForm />
    </div>
  );
}
