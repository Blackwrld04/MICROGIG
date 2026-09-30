import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { Card } from "@/components/ui/card";
import { USE_MOCKS } from "@/mocks/config";

export const metadata: Metadata = { title: "Sign in" };

/** Sign in — AUTH-02 / AUTH-03. `?next=` returns the user to the page that required sign-in. */
export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="container flex justify-center py-10">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your client or freelancer account.</p>
        </div>
        <LoginForm next={searchParams.next} showDemo={USE_MOCKS} />
      </Card>
    </div>
  );
}
