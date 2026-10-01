import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Create your account" };

/** Registration — AUTH-01. `?role=client|freelancer` preselects the account type. */
export default function RegisterPage({ searchParams }: { searchParams: { role?: string; next?: string } }) {
  const initialType = searchParams.role === "freelancer" ? "FREELANCER" : searchParams.role === "client" ? "CLIENT" : undefined;
  return (
    <div className="container flex justify-center py-10">
      <Card className="w-full max-w-lg space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free to join. Clients pay no service fee; freelancers keep 80% of every order.</p>
        </div>
        <RegisterForm initialType={initialType} next={searchParams.next} />
      </Card>
    </div>
  );
}
