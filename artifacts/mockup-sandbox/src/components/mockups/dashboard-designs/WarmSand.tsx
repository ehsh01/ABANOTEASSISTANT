import React, { useState } from "react";
import { 
  BarChart3, 
  BrainCircuit, 
  Check, 
  ChevronRight, 
  Clock, 
  FileText, 
  Globe, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Settings, 
  ShieldCheck, 
  Sparkles, 
  Users 
} from "lucide-react";

export default function WarmSand() {
  const [activeStep, setActiveStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<number | null>(2);

  return (
    <div 
      className="min-h-screen w-full text-[#1C1917] font-sans overflow-x-hidden"
      style={{ 
        backgroundColor: "#FAF7F2",
        fontFamily: "'Plus Jakarta Sans', sans-serif" 
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      `}} />

      {/* 1. Sticky Navbar */}
      <nav className="sticky top-0 z-50 w-full px-6 py-4 flex items-center justify-between"
           style={{ backgroundColor: "#FAF7F2", borderBottom: "1px solid #EDE8DF" }}>
        
        {/* Logo left */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1C1917] flex items-center justify-center text-white">
            <Sparkles size={16} />
          </div>
          <span className="font-bold text-xl tracking-tight text-[#1C1917]">AbaNote</span>
        </div>

        {/* Nav links center */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="#" className="text-[#1C1917] flex items-center gap-2">
            <LayoutDashboard size={16} />
            Dashboard
          </a>
          <a href="#" className="text-[#1C1917]/60 hover:text-[#1C1917] transition-colors flex items-center gap-2">
            <FileText size={16} />
            Notes
          </a>
          <a href="#" className="text-[#1C1917]/60 hover:text-[#1C1917] transition-colors flex items-center gap-2">
            <Users size={16} />
            Clients
          </a>
          <a href="#" className="text-[#1C1917]/60 hover:text-[#1C1917] transition-colors flex items-center gap-2">
            <Settings size={16} />
            Admin
          </a>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-sm font-medium text-[#1C1917]/70 hover:text-[#1C1917]">
            <Globe size={16} />
            <span>EN</span>
          </button>
          
          <div className="w-px h-5 bg-[#EDE8DF] mx-1"></div>
          
          <button className="flex items-center gap-1.5 text-sm font-medium text-[#1C1917]/70 hover:text-[#1C1917]">
            <LogOut size={16} />
            <span className="hidden sm:inline">Log out</span>
          </button>
          
          <button className="ml-2 px-4 py-2 bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
            <Plus size={16} />
            <span>New Note</span>
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section 
        className="w-full pt-20 pb-48 px-6 relative overflow-hidden"
        style={{ 
          background: "linear-gradient(150deg, #1C1917 0%, #292524 60%, #3D2B1F 100%)",
        }}
      >
        {/* Decorative background grain/noise */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
             
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center text-center">
          
          {/* Eyebrow badge */}
          <div className="mb-8 px-4 py-1.5 rounded-full border bg-white/10 backdrop-blur-md text-white/90 text-sm font-medium flex items-center gap-2"
               style={{ borderColor: "rgba(180, 83, 9, 0.5)" }}>
            <Sparkles size={14} className="text-[#B45309]" />
            <span>AI-Powered ABA Therapy Notes</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6 max-w-4xl">
            Session notes written <br className="hidden md:block"/> in seconds.
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-white/75 mb-10 max-w-2xl font-medium leading-relaxed">
            Generate compliant, professional therapy notes while you focus on what matters most — your clients.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <button className="px-8 py-3.5 bg-white text-[#1C1917] rounded-xl font-bold text-base shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-105 transition-transform flex items-center gap-2">
              Generate a Note
              <ChevronRight size={18} />
            </button>
            <button className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-base backdrop-blur-sm transition-colors border border-white/10">
              View All Notes
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-white/75 text-sm font-medium">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#B45309]" />
              <span>15 min saved per note</span>
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/20"></div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#B45309]" />
              <span>100% Compliance Rate</span>
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/20"></div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#B45309]" />
              <span>5,000+ notes generated</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Floating Wizard Card & 4. Feature Cards */}
      <section className="max-w-5xl mx-auto px-6 relative z-20 pb-32">
        
        {/* Floating Wizard Card */}
        <div 
          className="bg-white rounded-3xl -mt-28 mb-20 overflow-hidden relative flex flex-col transition-all duration-500 ease-out border border-[#EDE8DF]/50"
          style={{ 
            boxShadow: "0 32px 80px rgba(28,25,23,0.10), 0 1px 0 rgba(255,255,255,1) inset"
          }}
        >
          {/* Header & Steps */}
          <div className="p-8 pb-6 border-b border-[#EDE8DF]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#1C1917] mb-1">Select Client</h2>
                <p className="text-[#1C1917]/60 text-sm">Who is this session for?</p>
              </div>
              
              {/* Step indicator */}
              <div className="flex items-center">
                {[1, 2, 3, 4].map((step, idx) => (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center gap-2">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                          step <= activeStep 
                            ? "bg-[#B45309] text-white shadow-sm" 
                            : "bg-[#E7E3DC] text-[#1C1917]/40"
                        }`}
                      >
                        {step < activeStep ? <Check size={14} strokeWidth={3} /> : step}
                      </div>
                    </div>
                    {idx < 3 && (
                      <div 
                        className={`w-8 sm:w-12 h-0.5 mx-2 rounded-full transition-colors ${
                          step < activeStep ? "bg-[#B45309]" : "bg-[#E7E3DC]"
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Body content - Sub cards */}
          <div className="p-8 bg-[#FAF7F2]/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Client Card 1 */}
              <button 
                onClick={() => setSelectedClient(1)}
                className={`p-6 rounded-2xl text-left flex items-start gap-4 transition-all duration-200 border-2 ${
                  selectedClient === 1 
                    ? "bg-white border-[#B45309] shadow-[0_8px_24px_rgba(180,83,9,0.12)] border-l-4" 
                    : "bg-[#FAF7F2] border-[#EDE8DF] hover:border-[#1C1917]/20 hover:shadow-sm"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg flex-shrink-0">
                  AJ
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-lg mb-1">Alex Johnson</h3>
                  <div className="text-sm text-[#1C1917]/60 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock size={14} /> 9:00 AM</span>
                    <span className="flex items-center gap-1"><BrainCircuit size={14} /> DTT, NET</span>
                  </div>
                </div>
              </button>

              {/* Client Card 2 */}
              <button 
                onClick={() => setSelectedClient(2)}
                className={`p-6 rounded-2xl text-left flex items-start gap-4 transition-all duration-200 border-2 ${
                  selectedClient === 2 
                    ? "bg-white border-[#B45309] shadow-[0_8px_24px_rgba(180,83,9,0.12)] border-l-4" 
                    : "bg-[#FAF7F2] border-[#EDE8DF] hover:border-[#1C1917]/20 hover:shadow-sm"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg flex-shrink-0">
                  MS
                </div>
                <div>
                  <h3 className="font-bold text-[#1C1917] text-lg mb-1">Mia Smith</h3>
                  <div className="text-sm text-[#1C1917]/60 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock size={14} /> 11:30 AM</span>
                    <span className="flex items-center gap-1"><BrainCircuit size={14} /> NET, PRT</span>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="mt-4">
              <button className="text-sm font-medium text-[#B45309] hover:text-[#92400e] flex items-center gap-1">
                <Plus size={16} /> Select different client
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#EDE8DF] bg-white flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1C1917]/50">Step 1 of 8</span>
            <button 
              className="px-6 py-2.5 bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedClient}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 4. Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-2xl border border-[#EDE8DF] shadow-[0_4px_24px_rgba(28,25,23,0.03)] hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)] hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-6 text-[#B45309]">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1C1917] mb-3">ABA Note Types</h3>
            <p className="text-[#1C1917]/60 text-sm leading-relaxed">
              Support for comprehensive session notes, parent training, assessments, and structured DTT/NET documentation.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-2xl border border-[#EDE8DF] shadow-[0_4px_24px_rgba(28,25,23,0.03)] hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)] hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-6 text-[#B45309]">
              <BrainCircuit size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1C1917] mb-3">Smart Programs</h3>
            <p className="text-[#1C1917]/60 text-sm leading-relaxed">
              Auto-suggests relevant behavior reduction and skill acquisition programs based on client history.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-2xl border border-[#EDE8DF] shadow-[0_4px_24px_rgba(28,25,23,0.03)] hover:shadow-[0_12px_32px_rgba(28,25,23,0.08)] hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-6 text-[#B45309]">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-lg font-bold text-[#1C1917] mb-3">Instant Generation</h3>
            <p className="text-[#1C1917]/60 text-sm leading-relaxed">
              Transforms shorthand inputs into perfectly formatted, medically necessary narratives in seconds.
            </p>
          </div>
        </div>

      </section>
    </div>
  );
}
