import { useState } from "react";
import { Link, Redirect } from "wouter";
import { useRegister, useResendVerification } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (res) => {
        if (!res.success || !res.data) return;
        const d = res.data;
        if (d.pendingEmailVerification) {
          setPendingEmail(email.trim().toLowerCase());
          toast({
            title: "Check your email",
            description: d.message,
          });
          return;
        }
        if (d.token && d.user && d.company) {
          setSession(d.token, d.user as import("@/store/auth-store").SessionUser, d.company);
          if (d.message) {
            toast({ title: "Welcome", description: d.message });
          }
        }
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        const msg = err?.data?.error ?? err.message ?? "Registration failed";
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
      },
    },
  });

  const resendMutation = useResendVerification({
    mutation: {
      onSuccess: (res) => {
        toast({ title: "Email", description: res.message });
      },
      onError: () => {
        toast({
          title: "Could not resend",
          description: "Try again in a few minutes.",
          variant: "destructive",
        });
      },
    },
  });

  if (token) {
    return <Redirect to="/" />;
  }

  if (pendingEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Confirm your email</CardTitle>
            <CardDescription>
              We sent a link to <span className="font-medium text-foreground">{pendingEmail}</span>. Open
              it to activate your account, then sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate({ data: { email: pendingEmail } })}
            >
              {resendMutation.isPending ? "Sending…" : "Resend confirmation email"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              <Link href="/login" className="text-primary underline">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Creates your organization and user in one step.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const em = email.trim().toLowerCase();
              const em2 = emailConfirm.trim().toLowerCase();
              if (em !== em2) {
                toast({
                  title: "Emails do not match",
                  description: "Enter the same email address in both fields.",
                  variant: "destructive",
                });
                return;
              }
              if (password !== passwordConfirm) {
                toast({
                  title: "Passwords do not match",
                  description: "Enter the same password in both fields.",
                  variant: "destructive",
                });
                return;
              }
              if (password.length < 8) {
                toast({
                  title: "Password too short",
                  description: "Use at least 8 characters.",
                  variant: "destructive",
                });
                return;
              }
              registerMutation.mutate({
                data: { email: em, password, companyName: companyName.trim() },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="company">Company name</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
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
              <Label htmlFor="email-confirm">Confirm email</Label>
              <Input
                id="email-confirm"
                type="email"
                autoComplete="email"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (min 8 characters)</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-confirm">Confirm password</Label>
              <Input
                id="password-confirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating account…" : "Register"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
