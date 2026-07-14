import React, { useState } from "react";
import { Lock, Mail, Eye, EyeOff, Zap, Shield, Users } from "lucide-react";

export function ForestSage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <link
        rel="stylesheet"
        media="print"
        onLoad={(e) => (e.currentTarget.media = 'all')}
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div
        className="min-h-screen w-full flex items-center justify-center p-4"
        style={{
          backgroundColor: "#F0F4F1",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div className="w-full max-w-[900px] flex flex-col md:flex-row bg-[#FAFDF9] rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
          {/* Left Panel */}
          <div 
            className="md:w-1/2 p-8 md:p-10 flex flex-col relative overflow-hidden"
            style={{ 
              backgroundColor: "#0D2818",
              backgroundImage: "radial-gradient(circle at 20% 30%, #1A3D25 0%, transparent 40%), radial-gradient(circle at 80% 80%, #1A3D25 0%, transparent 40%)"
            }}
          >
            <div className="flex items-center gap-2 mb-8 relative z-10">
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ backgroundColor: "#4ADE80" }}
              >
                <div className="w-2.5 h-2.5 bg-[#0D2818] rounded-full"></div>
              </div>
              <span className="font-semibold text-white text-sm tracking-wide">
                ABA Note Assistant
              </span>
            </div>

            <div className="relative z-10">
              <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                <span className="block text-white">Smart Notes.</span>
                <span
                  className="block"
                  style={{ color: "#4ADE80" }}
                >
                  Better Outcomes.
                </span>
              </h1>
              <p className="text-gray-300 text-sm leading-relaxed mb-8 pr-4 font-medium">
                The all-in-one ABA note generator that saves you time so you can
                focus on what matters most.
              </p>

              <div className="flex flex-col gap-5 mb-12">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#1A3D25" }}>
                    <Zap size={16} color="#4ADE80" />
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#1A3D25" }}>
                    <Shield size={16} color="#4ADE80" />
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
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#1A3D25" }}>
                    <Users size={16} color="#4ADE80" />
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

            <div className="mt-auto relative rounded-2xl overflow-hidden h-48 w-full z-10 flex-shrink-0">
              <div className="absolute inset-0 rounded-t-[3rem] scale-110 translate-y-8 origin-bottom" style={{ backgroundColor: "#1A3D25" }}></div>
              <img
                src="/__mockup/images/therapist-hero.png"
                alt="Therapist with child"
                className="w-full h-full object-cover object-top relative z-10 opacity-90 mix-blend-luminosity"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>

          {/* Right Panel */}
          <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center border-l border-gray-100" style={{ backgroundColor: "#FAFDF9" }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "#ECFDF5" }}>
              <Lock size={20} style={{ color: "#16A34A" }} />
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: "#052E16" }}>
              Welcome back!
            </h2>
            <p className="text-gray-500 text-sm mb-8">
              Log in to your ABA Note Assistant account
            </p>

            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] transition-colors bg-white"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A] transition-colors bg-white"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 mb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="w-4 h-4 rounded border border-gray-300 group-hover:border-[#16A34A] flex items-center justify-center transition-colors bg-white">
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    Remember me
                  </span>
                </label>
                <a
                  href="#"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#16A34A" }}
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90 mt-2 shadow-sm shadow-green-900/10"
                style={{ backgroundColor: "#16A34A" }}
              >
                Sign In
              </button>
            </form>

            <div className="flex items-center gap-4 my-8">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-xs text-gray-400 font-medium px-2">
                or continue with
              </span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            <div className="flex gap-3 mb-8">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border bg-white hover:bg-gray-50 transition-colors" style={{ borderColor: "#D1FAE5" }}>
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
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border bg-white hover:bg-gray-50 transition-colors" style={{ borderColor: "#D1FAE5" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                  <path d="M12.41 11.23c-.02-2.12 1.73-3.15 1.81-3.2-1-1.46-2.55-1.65-3.1-1.68-1.32-.13-2.57.78-3.25.78-.67 0-1.7-.76-2.79-.74-1.43.02-2.75.83-3.48 2.11-1.5 2.62-.38 6.49 1.08 8.62.71 1.04 1.55 2.19 2.68 2.15 1.08-.04 1.49-.69 2.8-.69 1.3 0 1.68.7 2.81.68 1.16-.02 1.88-1.05 2.58-2.08.81-1.18 1.14-2.33 1.16-2.39-.02-.01-2.24-.86-2.26-3.46zM15.42 4.41c.6-1.02 1.25-2.26.96-3.41-1.12.06-2.5.76-3.23 1.76-.6.81-1.18 2.06-1.02 3.26 1.22.1 2.55-.63 3.29-1.61z" />
                </svg>
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Don't have an account?{" "}
                <a
                  href="#"
                  className="font-semibold hover:underline"
                  style={{ color: "#16A34A" }}
                >
                  Register &rarr;
                </a>
              </p>
              <a
                href="#"
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
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
