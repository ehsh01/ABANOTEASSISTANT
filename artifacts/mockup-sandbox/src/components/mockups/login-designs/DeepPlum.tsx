import React from "react";
import { ArrowRight, CheckCircle2, Lock, Zap, Shield, Users, Mail, Apple, Github } from "lucide-react";

export function DeepPlum() {
  return (
    <div
      className="min-h-screen w-full flex font-sans text-slate-900"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: "#1A0B2E",
      }}
    >
      <link
        rel="stylesheet"
        media="print"
        onLoad={(e) => {
          (e.target as any).media = "all";
        }}
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />

      {/* Left Panel */}
      <div className="relative hidden lg:flex flex-col w-1/2 p-12 overflow-hidden bg-[#1A0B2E]">
        {/* Aurora Background Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#FF6B6B] opacity-20 blur-[100px] pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#C084FC] opacity-20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[20%] w-[70%] h-[70%] rounded-full bg-[#FB923C] opacity-15 blur-[150px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B6B] to-[#C084FC] flex items-center justify-center text-white font-bold shadow-lg">
              <Zap size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-bold text-white tracking-wide">
              ABA Note Assistant
            </span>
          </div>

          <div className="max-w-xl">
            <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
              <span className="text-white block">Smart Notes.</span>
              <span
                className="block text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(to right, #FF6B6B, #C084FC)",
                }}
              >
                Better Outcomes.
              </span>
            </h1>
            <p className="text-lg text-white/70 mb-12 max-w-md leading-relaxed">
              The all-in-one ABA note generator that saves you time so you can
              focus on what matters most.
            </p>

            <div className="flex flex-col gap-5 mb-12">
              {[
                { icon: Zap, text: "AI-Powered" },
                { icon: Shield, text: "HIPAA Secure" },
                { icon: Users, text: "Built for ABA" },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-4 text-white">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-sm">
                    <feature.icon size={18} className="text-white" />
                  </div>
                  <span className="font-semibold text-lg">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A0B2E] via-transparent to-transparent z-10" />
            <img
              src="/__mockup/images/therapist-hero.png"
              alt="Therapist"
              className="w-full h-64 object-cover opacity-80"
            />
          </div>
        </div>
      </div>

      {/* Right Panel (Login) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10">
        <div
          className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10"
          style={{
            boxShadow: "0 20px 40px rgba(192, 132, 252, 0.15)",
          }}
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#FDF4FF] flex items-center justify-center">
              <Lock size={28} color="#C084FC" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-[#1A0B2E] mb-2">
              Welcome back!
            </h2>
            <p className="text-slate-500">Sign in to continue to your account</p>
          </div>

          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#1A0B2E] block">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all"
                  style={{
                    focusRingColor: "rgba(192, 132, 252, 0.4)",
                  } as any}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#C084FC";
                    e.target.style.boxShadow = "0 0 0 4px rgba(192, 132, 252, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E2E8F0";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#1A0B2E] block">
                  Password
                </label>
                <a
                  href="#"
                  className="text-sm font-semibold text-[#C084FC] hover:text-[#A855F7] transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all"
                  onFocus={(e) => {
                    e.target.style.borderColor = "#C084FC";
                    e.target.style.boxShadow = "0 0 0 4px rgba(192, 132, 252, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E2E8F0";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{
                backgroundImage: "linear-gradient(to right, #FF6B6B, #C084FC)",
                boxShadow: "0 8px 20px rgba(192, 132, 252, 0.3)",
              }}
            >
              Sign In <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8">
            <div className="relative flex items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="px-4 text-xs font-medium text-slate-400 bg-white">
                OR CONTINUE WITH
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[#F3E8FF] rounded-xl hover:bg-slate-50 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-700">Google</span>
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[#F3E8FF] rounded-xl hover:bg-slate-50 transition-colors">
                <Apple size={20} className="text-slate-800" />
                <span className="text-sm font-semibold text-slate-700">Apple</span>
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            No account?{" "}
            <a
              href="#"
              className="font-bold text-[#C084FC] hover:text-[#A855F7] transition-colors"
            >
              Register
            </a>{" "}
            ·{" "}
            <a
              href="#"
              className="font-semibold text-slate-700 hover:text-[#1A0B2E] transition-colors"
            >
              See plans
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default DeepPlum;
