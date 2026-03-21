import { useState } from "react";
import { Link, Redirect } from "wouter";
import { useLogin } from "@workspace/api-client-react";
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
