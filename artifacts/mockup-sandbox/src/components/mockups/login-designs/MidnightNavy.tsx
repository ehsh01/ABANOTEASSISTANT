import React, { useState } from "react";
import { Lock, Mail, Eye, EyeOff, Zap, Shield, Users } from "lucide-react";

export function MidnightNavy() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <link
        rel="stylesheet"
        media="print"
        // @ts-expect-error - inline onLoad handler
        onLoad={(e) => (e.currentTarget.media = 'all')}
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div
        className="min-h-screen w-full flex items-center justify-center p-4"
        style={{
          backgroundColor: "#070B14",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div className="w-full max-w-[900px] flex flex-col md:flex-row bg-[#0D1526] rounded-3xl overflow-hidden shadow-2xl border border-gray-800/50">
          {/* Left Panel */}
          <div 
            className="md:w-1/2 p-8 md:p-10 flex flex-col relative overflow-hidden"
            style={{
              background: "radial-gradient(circle at top right, #1E3A5F 0%, #0D1526 60%)"
            }}
          >
            <div className="flex items-center gap-2 mb-8 relative z-10">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: "#3B82F6" }}
              >
                <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
              <span className="font-semibold text-white text-sm tracking-wide">
                ABA Note Assistant
              </span>
            </div>

            <div className="relative z-10">
              <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                <span className="block text-white">Smart Notes.</span>
                <span
                  className="block text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(to right, #60A5FA, #818CF8)" }}
                >
                  Better Outcomes.
                </span>
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed mb-8 pr-4">
                The all-in-one ABA note generator that saves you time so you can
                focus on what matters most.
              </p>

              <div className="flex flex-col gap-5 mb-12">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                    <Zap size={16} color="#60A5FA" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      AI-Powered
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Generate accurate, high-quality notes in seconds.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                    <Shield size={16} color="#60A5FA" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      HIPAA Secure
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Your data is always protected and private.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                    <Users size={16} color="#60A5FA" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">
                      Built for ABA
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Designed by BCBAs for behavior professionals.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto relative rounded-2xl overflow-hidden h-48 w-full z-10 flex-shrink-0 shadow-lg border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-b from-[#0D1526] via-transparent to-transparent z-20"></div>
              <img
                src="/__mockup/images/therapist-hero.png"
                alt="Therapist with child"
                className="w-full h-full object-cover object-top relative z-10 opacity-90"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-[#3B82F6] mix-blend-overlay opacity-20 z-20"></div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white shadow-[0_0_40px_rgba(0,0,0,0.3)] z-20 md:-ml-4 rounded-3xl m-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "#EFF6FF" }}>
              <Lock size={20} className="text-[#3B82F6]" />
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: "#0F172A" }}>
              Welcome back!
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              Log in to your ABA Note Assistant account
            </p>

            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400 group-focus-within:text-[#3B82F6] transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition-all bg-gray-50/50"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400 group-focus-within:text-[#3B82F6] transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition-all bg-gray-50/50"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 mb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="w-4 h-4 rounded border border-gray-300 group-hover:border-[#3B82F6] flex items-center justify-center transition-colors">
                    {/* Checkmark would go here if checked */}
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#3B82F6" }}
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:bg-blue-600 mt-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-[0.98]"
                style={{ backgroundColor: "#3B82F6" }}
              >
                Sign In
              </button>
            </form>

            <div className="flex items-center gap-4 my-8">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-xs text-gray-400 font-medium px-2 uppercase tracking-wider">
                or continue with
              </span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            <div className="flex gap-3 mb-8">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-gray-50 transition-colors shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-gray-50 transition-colors shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                  <path d="M12.41 11.23c-.02-2.12 1.73-3.15 1.81-3.2-1-1.46-2.55-1.65-3.1-1.68-1.32-.13-2.57.78-3.25.78-.67 0-1.7-.76-2.79-.74-1.43.02-2.75.83-3.48 2.11-1.5 2.62-.38 6.49 1.08 8.62.71 1.04 1.55 2.19 2.68 2.15 1.08-.04 1.49-.69 2.8-.69 1.3 0 1.68.7 2.81.68 1.16-.02 1.88-1.05 2.58-2.08.81-1.18 1.14-2.33 1.16-2.39-.02-.01-2.24-.86-2.26-3.46zM15.42 4.41c.6-1.02 1.25-2.26.96-3.41-1.12.06-2.5.76-3.23 1.76-.6.81-1.18 2.06-1.02 3.26 1.22.1 2.55-.63 3.29-1.61z" />
                </svg>
              </button>
            </div>

            <div className="text-center mt-auto">
              <p className="text-sm text-gray-600 mb-2">
                Don't have an account?{" "}
                <a
                  href="#"
                  className="font-semibold hover:underline"
                  style={{ color: "#3B82F6" }}
                >
                  Create one &rarr;
                </a>
              </p>
              <a
                href="#"
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors"
              >
                See plans
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
