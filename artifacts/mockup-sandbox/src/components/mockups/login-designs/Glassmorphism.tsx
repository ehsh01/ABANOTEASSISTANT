import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Sparkles } from "lucide-react";

export function Glassmorphism() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login", { email, password });
  };

  return (
    <div 
      className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #31164a 100%)',
      }}
    >
      {/* Bokeh circles */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full mix-blend-screen opacity-40 blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #C27A8A 0%, rgba(194, 122, 138, 0) 70%)'
        }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-30 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #818cf8 0%, rgba(129, 140, 248, 0) 70%)'
        }}
      />
      <div 
        className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full mix-blend-screen opacity-20 blur-[80px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #f472b6 0%, rgba(244, 114, 182, 0) 70%)'
        }}
      />

      {/* Glass Card */}
      <div 
        className="relative z-10 w-full max-w-md mx-4 p-8 sm:p-10 rounded-[2rem] border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C27A8A] to-[#8c505e] flex items-center justify-center mb-4 shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">ABA Note Assistant</h1>
          <p className="text-white/60 text-sm mt-2">Welcome back, please sign in.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80 ml-1">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-[#C27A8A] focus-visible:border-transparent h-12 px-4 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <a href="#" className="text-xs text-[#C27A8A] hover:text-white transition-colors">
                Forgot password?
              </a>
            </div>
            <Input 
              id="password" 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-[#C27A8A] focus-visible:border-transparent h-12 px-4 rounded-xl"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 mt-4 rounded-xl font-medium text-white shadow-lg shadow-[#C27A8A]/20 transition-all hover:shadow-[#C27A8A]/40 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(to right, #C27A8A, #a96372)',
            }}
          >
            Sign in
            <ArrowRight className="w-4 h-4 ml-2 opacity-80" />
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col items-center space-y-3 text-sm">
          <p className="text-white/60">
            No account?{' '}
            <a href="#" className="text-white font-medium hover:text-[#C27A8A] transition-colors">
              Register
            </a>
          </p>
          <a href="#" className="text-white/40 hover:text-white transition-colors">
            See plans
          </a>
        </div>
      </div>
    </div>
  );
}
