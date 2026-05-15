import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useLogin, useResendVerification } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";
import { navigateToAppRoot } from "@/lib/navigate-app-root";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Lock, Zap, Shield, Users, Mail, Eye, EyeOff, Apple } from "lucide-react";

export default function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      toast({ title: "Email verified", description: "You can sign in now." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        if (!res.success || !res.data) return;
        const { token: t, user, company } = res.data;
        setSession(t, user as import("@/store/auth-store").SessionUser, company);
        navigateToAppRoot();
      },
      onError: (err: Error & { data?: { error?: string } }) => {
        const msg = err?.data?.error ?? err.message ?? "Login failed";
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      },
    },
  });

  if (token) return <Redirect to="/" />;

  const focusStyle = {
    borderColor: "#C084FC",
    boxShadow: "0 0 0 4px rgba(192, 132, 252, 0.2)",
    outline: "none",
  };
  const blurStyle = { borderColor: "#E2E8F0", boxShadow: "none" };

  return (
    <div
      className="min-h-screen w-full flex font-sans"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: "#1A0B2E" }}
    >
      {/* ── Left Panel ── */}
      <div className="relative hidden lg:flex flex-col w-1/2 p-12 overflow-hidden bg-[#1A0B2E]">
        {/* Aurora blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FF6B6B] opacity-20 blur-[100px] pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#C084FC] opacity-20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[20%] w-[70%] h-[70%] rounded-full bg-[#FB923C] opacity-[0.15] blur-[150px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B6B] to-[#C084FC] flex items-center justify-center shadow-lg">
              <Zap size={20} className="text-white" fill="white" />
            </div>
            <span className="text-xl font-bold text-white tracking-wide">ABA Note Assistant</span>
          </div>

          {/* Headline */}
          <div className="max-w-xl">
            <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
              <span className="text-white block">Smart Notes.</span>
              <span
                className="block text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(to right, #FF6B6B, #C084FC)" }}
              >
                Better Outcomes.
              </span>
            </h1>
            <p className="text-lg text-white/70 mb-12 max-w-md leading-relaxed">
              The all-in-one ABA note generator that saves you time so you can focus on what matters most.
            </p>

            {/* Feature bullets */}
            <div className="flex flex-col gap-5 mb-12">
              {[
                { icon: Zap, label: "AI-Powered", sub: "Generate accurate, high-quality notes in seconds." },
                { icon: Shield, label: "HIPAA Secure", sub: "Your data is always protected and private." },
                { icon: Users, label: "Built for ABA", sub: "Designed by BCBAs for behavior professionals." },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-start gap-4 text-white">
                  <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-white/10 border border-white/20">
                    <Icon size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">{label}</p>
                    <p className="text-sm text-white/60">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero photo */}
          <div className="mt-8 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0B2E]/60 via-transparent to-transparent z-10" />
            <img
              src="/images/therapist-hero.png"
              alt="ABA therapist with child"
              className="w-full h-72 object-cover opacity-90"
              style={{ objectPosition: "center 65%" }}
            />
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div
          className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10"
          style={{ boxShadow: "0 20px 40px rgba(192, 132, 252, 0.2)" }}
        >
          {/* Lock icon */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#FDF4FF] flex items-center justify-center">
              <Lock size={28} color="#C084FC" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#1A0B2E] mb-2">Welcome back!</h2>
            <p className="text-slate-500 text-sm">Sign in to continue to your account</p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate({ data: { email: email.trim().toLowerCase(), password } });
            }}
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#1A0B2E] block" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  onFocus={(e) => Object.assign(e.target.style, focusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, blurStyle)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#1A0B2E] block" htmlFor="password">
                  Password
                </label>
                <span className="text-sm font-semibold text-[#C084FC]">Forgot password?</span>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all"
                  onFocus={(e) => Object.assign(e.target.style, focusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, blurStyle)}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all hover:scale-[1.02] active:scale-100 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(to right, #FF6B6B, #C084FC)",
                boxShadow: "0 8px 20px rgba(192, 132, 252, 0.3)",
              }}
            >
              {loginMutation.isPending ? "Signing in…" : <>Sign In <ArrowRight size={18} /></>}
            </button>
          </form>

          {/* Social divider */}
          <div className="mt-8">
            <div className="relative flex items-center mb-5">
              <div className="flex-grow border-t border-slate-200" />
              <span className="px-4 text-xs font-medium text-slate-400 bg-white">OR CONTINUE WITH</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                disabled
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[#F3E8FF] rounded-xl opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="text-sm font-semibold text-slate-700">Google</span>
              </button>
              <button
                disabled
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[#F3E8FF] rounded-xl opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                <Apple size={20} className="text-slate-800" />
                <span className="text-sm font-semibold text-slate-700">Apple</span>
              </button>
            </div>
          </div>

          {/* Footer links */}
          <p className="mt-8 text-center text-sm text-slate-500">
            No account?{" "}
            <Link href="/register" className="font-bold text-[#C084FC] hover:text-[#A855F7] transition-colors">
              Register
            </Link>
            {" · "}
            <Link href="/pricing" className="font-semibold text-slate-700 hover:text-[#1A0B2E] transition-colors">
              See plans
            </Link>
          </p>

          {/* Resend verification */}
          {!showResend ? (
            <button
              type="button"
              className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 underline-offset-4 hover:underline transition-colors"
              onClick={() => setShowResend(true)}
            >
              Didn't get a confirmation email?
            </button>
          ) : (
            <div className="mt-4 space-y-2 rounded-xl border border-[#F3E8FF] bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                Enter your email and we'll send a new confirmation link if the account exists and isn't verified yet.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
                  onFocus={(e) => Object.assign(e.target.style, focusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, blurStyle)}
                />
                <button
                  type="button"
                  disabled={resendMutation.isPending || !email.trim()}
                  onClick={() => resendMutation.mutate({ data: { email: email.trim().toLowerCase() } })}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-all"
                  style={{ backgroundImage: "linear-gradient(to right, #FF6B6B, #C084FC)" }}
                >
                  {resendMutation.isPending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
