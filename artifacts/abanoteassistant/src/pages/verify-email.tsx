import { useEffect, useRef, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmailPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [queryToken, setQueryToken] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setQueryToken(t);
  }, []);

  const verifyMutation = useVerifyEmail({
    mutation: {
      onSuccess: (res) => {
        if (!res.success) return;
        setLocation("/login?verified=1");
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        const msg = err?.data?.error ?? err.message ?? "Verification failed";
        toast({ title: "Could not verify", description: msg, variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (!queryToken || attempted.current) return;
    attempted.current = true;
    verifyMutation.mutate({ data: { token: queryToken } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when token from URL is known
  }, [queryToken]);

  if (token) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirming your email</CardTitle>
          <CardDescription>
            {queryToken
              ? "Hang tight — we’re validating your link."
              : "This page needs a confirmation link from your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!queryToken ? (
            <p className="text-sm text-muted-foreground">
              Open the link from your registration email, or{" "}
              <Link href="/register" className="text-primary underline">
                register again
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {verifyMutation.isPending ? "Working…" : verifyMutation.isError ? "Something went wrong." : "Done."}
            </p>
          )}
          {queryToken && verifyMutation.isError ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                attempted.current = false;
                verifyMutation.mutate({ data: { token: queryToken } });
              }}
              disabled={verifyMutation.isPending}
            >
              Try again
            </Button>
          ) : null}
          <p className="text-sm text-center text-muted-foreground">
            <Link href="/login" className="text-primary underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
