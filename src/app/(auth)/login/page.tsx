import type { Metadata } from "next";
import { DemoAuthNotice, LoginForm } from "@/components/auth/auth-forms";
import { Card } from "@/components/ui/card";
import { USE_MOCKS } from "@/mocks/config";

export const metadata: Metadata = { title: "Sign in" };

/** Sign in — AUTH-02 / AUTH-03. */
export default function LoginPage() {
  return (
    <div className="container flex justify-center py-10">
      <Card className="w-full max-w-md space-y-5 p-6">
        <h1 className="text-2xl font-bold">Sign in to microgig</h1>
        {USE_MOCKS ? <DemoAuthNotice /> : null}
        <LoginForm />
      </Card>
    </div>
  );
}
