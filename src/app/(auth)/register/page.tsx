import type { Metadata } from "next";
import { DemoAuthNotice, RegisterForm } from "@/components/auth/auth-forms";
import { Card } from "@/components/ui/card";
import { USE_MOCKS } from "@/mocks/config";

export const metadata: Metadata = { title: "Join microgig" };

/** Registration — AUTH-01. */
export default function RegisterPage() {
  return (
    <div className="container flex justify-center py-10">
      <Card className="w-full max-w-md space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Join microgig</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buy fixed-price micro-gigs, or start selling your own.</p>
        </div>
        {USE_MOCKS ? <DemoAuthNotice /> : null}
        <RegisterForm />
      </Card>
    </div>
  );
}
