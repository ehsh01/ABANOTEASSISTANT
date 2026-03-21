import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useLogin, useResendVerification } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showResend, setShowResend] = useState(false);

  const resendMutation = useResendVerification({
    mutation: {
      onSuccess: (res) => {
        toast({ title: "Check your inbox", description: res.message });
      },
      onError: () => {
        toast({
          title: "Could not send",
          description: "Try again shortly.",
          variant: "destructive",
        });
      },
    },
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("verified") === "1") {
      toast({
        title: "Email verified",
        description: "You can sign in now.",
      });
      const path = window.location.pathname;
      window.history.replaceState({}, "", path);
    }
  }, [toast]);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        if (!res.success || !res.data) return;
        const { token: t, user, company } = res.data;
        setSession(t, user as import("@/store/auth-store").SessionUser, company);
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        const msg = err?.data?.error ?? err.message ?? "Login failed";
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      },
    },
  });

  if (token) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your company account email and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate({ data: { email, password } });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          {!showResend ? (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setShowResend(true)}
            >
              Didn&apos;t get a confirmation email?
            </button>
          ) : (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a new confirmation link if the account exists and isn&apos;t
                verified yet.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={resendMutation.isPending || !email.trim()}
                  onClick={() =>
                    resendMutation.mutate({
                      data: { email: email.trim().toLowerCase() },
                    })
                  }
                >
                  {resendMutation.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            No account?{" "}
            <Link href="/register" className="text-primary underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
