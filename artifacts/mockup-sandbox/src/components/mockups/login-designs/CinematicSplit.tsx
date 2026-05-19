import React, { useState } from "react";

export function CinematicSplit() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Sign in attempted", { email, password });
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>
      
      <div className="min-h-screen w-full flex flex-col md:flex-row font-jakarta selection:bg-[#C27A8A]/30">
        {/* Left Panel - Brand */}
        <div className="relative flex-1 bg-[#121214] flex flex-col justify-between p-12 overflow-hidden text-white">
          {/* Subtle Pink Glow */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#C27A8A] opacity-20 blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#C27A8A] opacity-10 blur-[150px] pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#C27A8A] to-[#a05f6e] flex items-center justify-center shadow-lg shadow-[#C27A8A]/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="font-playfair text-xl font-semibold tracking-wide">ABA Note Assistant</span>
            </div>
          </div>

          <div className="relative z-10 max-w-lg mt-24 mb-auto">
            <h1 className="font-playfair text-5xl md:text-6xl lg:text-7xl leading-tight font-semibold mb-6">
              Write better notes.<br />
              <span className="text-[#C27A8A] italic font-normal">Faster.</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-md font-light">
              The clinical-grade intelligence platform designed exclusively for ABA therapists. Reclaim your time and focus on what matters most.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-4 text-sm text-gray-500">
            <span>© 2024 ABA Note Assistant</span>
            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
            <span className="w-1 h-1 rounded-full bg-gray-700"></span>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-full md:w-[480px] lg:w-[560px] bg-white flex flex-col justify-center px-8 md:px-16 py-12">
          <div className="max-w-[360px] w-full mx-auto">
            <div className="mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3 tracking-tight">Sign in</h2>
              <p className="text-gray-500 text-sm">Enter your details to access your dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@clinic.com"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/20 focus:border-[#C27A8A] transition-all text-gray-900 placeholder-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="#" className="text-sm text-[#C27A8A] hover:text-[#a05f6e] font-medium transition-colors">
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C27A8A]/20 focus:border-[#C27A8A] transition-all text-gray-900 placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#C27A8A] hover:bg-[#b06a7a] text-white font-medium py-2.5 rounded-lg transition-colors shadow-sm mt-2"
              >
                Sign in
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-100 space-y-4">
              <p className="text-center text-sm text-gray-600">
                No account?{" "}
                <a href="#" className="font-medium text-[#C27A8A] hover:text-[#a05f6e] transition-colors">
                  Register
                </a>
              </p>
              <p className="text-center text-sm text-gray-500">
                Want to learn more?{" "}
                <a href="#" className="font-medium text-gray-900 hover:underline">
                  See plans
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
